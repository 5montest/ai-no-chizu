#!/usr/bin/env node
/**
 * 公開データの形式を検証する。ビルド前とデータ更新後に実行する。
 *   npm run validate:data
 *   npm run validate:data -- --staging
 *
 * 値そのものの正しさは人が確認する前提で、ここでは
 * 「未確認を未確認として書けているか」と「列の対応が崩れていないか」を見る。
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const STAGING = process.argv.includes('--staging');
const FILE = STAGING
  ? path.join(ROOT, 'data/staging/model-comparison.json')
  : path.join(ROOT, 'data/model-comparison.json');
const SNAPSHOT_FILE = path.join(ROOT, 'data/capability-snapshots.json');

const TIERS = new Set(['frontier', 'balanced', 'light']);
const PRICING_KINDS = new Set(['official', 'reseller']);
const BASES = new Set(['curated', 'hugging-face-id', 'unverified']);
const AXIS_KINDS = new Set(['spec', 'benchmark']);
const AXIS_STATUSES = new Set(['verified', 'unverified']);
const AXIS_RENDERS = new Set(['modality', 'reasoning']);
const errors = [];

function check(condition, message) {
  if (!condition) errors.push(message);
}

function isDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isHttps(value) {
  return typeof value === 'string' && value.startsWith('https://');
}

/** 値の中に価格の欄が混ざっていないか。能力の比較に価格を読ませない。 */
function findPriceKeys(node, trail = '') {
  if (!node || typeof node !== 'object') return [];
  const found = [];
  for (const [key, value] of Object.entries(node)) {
    const at = trail ? `${trail}.${key}` : key;
    if (/price|pricing/i.test(key)) found.push(at);
    found.push(...findPriceKeys(value, at));
  }
  return found;
}

/**
 * 評価軸スナップショットを検証する。
 * 確認済みの軸は出典と条件が揃っているか、未確認の軸は
 * 数値を出していないかを見る。
 */
async function validateSnapshot(sourceIds) {
  let data;
  try {
    data = JSON.parse(await fs.readFile(SNAPSHOT_FILE, 'utf8'));
  } catch (err) {
    check(false, `capability-snapshots.json を読み込めません (${err.message})`);
    return null;
  }

  const rel = path.relative(ROOT, SNAPSHOT_FILE);
  check(data.schema_version === 1, `${rel}: schema_version が 1 ではありません`);
  check(isDate(data.captured_at), `${rel}: captured_at が YYYY-MM-DD ではありません`);
  check(
    typeof data.source?.name === 'string' && data.source.name.length > 0,
    `${rel}: source.name が空です`,
  );
  check(isHttps(data.source?.url), `${rel}: source.url が https URL ではありません`);

  const policy = data.policy ?? {};
  check(typeof policy.publish_rule === 'string' && policy.publish_rule.length > 0,
    `${rel}: policy.publish_rule がありません`);
  check(policy.ordering === 'vendor-name', `${rel}: policy.ordering は vendor-name です`);
  check(typeof policy.price_separation === 'string' && policy.price_separation.length > 0,
    `${rel}: policy.price_separation がありません`);
  check(
    Number.isInteger(policy.freshness?.review_after_days) &&
      policy.freshness.review_after_days > 0,
    `${rel}: policy.freshness.review_after_days がありません`,
  );
  check(
    typeof policy.freshness?.display_rule === 'string' &&
      policy.freshness.display_rule.length > 0,
    `${rel}: policy.freshness.display_rule がありません`,
  );
  check(
    typeof policy.freshness?.stale_rule === 'string' && policy.freshness.stale_rule.length > 0,
    `${rel}: policy.freshness.stale_rule がありません`,
  );

  const axes = Array.isArray(data.axes) ? data.axes : [];
  check(axes.length > 0, `${rel}: axes が空です`);

  const axisIds = new Set();
  const axisLabels = new Set();
  let verifiedCount = 0;
  let pendingCount = 0;

  for (const [i, axis] of axes.entries()) {
    const at = `axes[${i}]${axis?.id ? `(${axis.id})` : ''}`;
    check(typeof axis?.id === 'string' && /^[a-z0-9-]+$/.test(axis.id), `${at}: id が不正です`);
    check(typeof axis?.label === 'string' && axis.label.length > 0, `${at}: label が空です`);
    check(typeof axis?.question === 'string' && axis.question.length > 0, `${at}: question が空です`);
    check(AXIS_KINDS.has(axis?.kind), `${at}: kind が不正です: ${axis?.kind}`);
    check(AXIS_STATUSES.has(axis?.status), `${at}: status が不正です: ${axis?.status}`);
    check(!axisIds.has(axis?.id), `${at}: 軸の id が重複しています`);
    check(!axisLabels.has(axis?.label), `${at}: 軸の label が重複しています`);
    axisIds.add(axis?.id);
    axisLabels.add(axis?.label);
    check(Array.isArray(axis?.values), `${at}: values が配列ではありません`);

    if (axis?.status === 'verified') {
      verifiedCount += 1;
      check(AXIS_RENDERS.has(axis.render), `${at}: 確認済みの軸に render がありません`);
      check(typeof axis.metric === 'string' && axis.metric.length > 0, `${at}: metric が空です`);
      check(
        typeof axis.conditions === 'string' && axis.conditions.length > 0,
        `${at}: conditions が空です`,
      );
      check(isDate(axis.measured_at), `${at}: measured_at が YYYY-MM-DD ではありません`);
      check(
        typeof axis.source?.name === 'string' && axis.source.name.length > 0,
        `${at}: source.name が空です`,
      );
      check(isHttps(axis.source?.url), `${at}: source.url が https URL ではありません`);
      check(
        typeof axis.source?.field === 'string' && axis.source.field.length > 0,
        `${at}: source.field が空です（出典のどこを見たか）`,
      );
      // 仕様の軸にベンチマーク名を書くと、能力の測定値に見える。
      check(axis.benchmark === null, `${at}: 仕様の軸に benchmark があります`);

      const seen = new Set();
      for (const [j, value] of (axis.values ?? []).entries()) {
        const valueAt = `${at}.values[${j}]`;
        check(
          typeof value?.model_id === 'string' && sourceIds.has(value.model_id),
          `${valueAt}: model_id がモデル一覧にありません: ${value?.model_id}`,
        );
        check(!seen.has(value?.model_id), `${valueAt}: 同じモデルの値が重複しています`);
        seen.add(value?.model_id);
        check(value?.value && typeof value.value === 'object', `${valueAt}: value がありません`);
      }
      check(
        seen.size === sourceIds.size,
        `${at}: ${seen.size}件の値がありますが、モデル一覧は${sourceIds.size}件です`,
      );
    } else if (axis?.status === 'unverified') {
      pendingCount += 1;
      check(axis.values?.length === 0, `${at}: 未確認の軸に値があります`);
      check(axis.metric === null, `${at}: 未確認の軸に metric があります`);
      check(axis.benchmark === null, `${at}: 未確認の軸に benchmark があります`);
      check(axis.conditions === null, `${at}: 未確認の軸に conditions があります`);
      check(axis.measured_at === null, `${at}: 未確認の軸に measured_at があります`);
      check(axis.source === null, `${at}: 未確認の軸に source があります`);
      check(typeof axis.note === 'string' && axis.note.length > 0, `${at}: note がありません`);
      check(
        Array.isArray(axis.needs) && axis.needs.length > 0,
        `${at}: needs（公開に必要な項目）がありません`,
      );
      check(
        Array.isArray(axis.candidate_benchmarks) && axis.candidate_benchmarks.length > 0,
        `${at}: candidate_benchmarks がありません`,
      );
    }
  }

  check(verifiedCount > 0, `${rel}: 確認済みの軸がありません`);
  check(pendingCount > 0, `${rel}: 未確認の軸がありません（未確認を明示してください）`);

  // 能力と価格は別の表。ここへ価格の欄を持ち込まない。
  // policy.price_separation は「分ける」方針を書く欄なので、値の側だけを見る。
  const { policy: _policy, ...dataWithoutPolicy } = data;
  for (const keyPath of findPriceKeys(dataWithoutPolicy)) {
    check(false, `${rel}: 価格の欄 ${keyPath} を能力の比較に持ち込んでいます`);
  }

  return { rel, captured_at: data.captured_at, verifiedCount, pendingCount, axes: axes.length };
}

async function main() {
  let data;
  try {
    data = JSON.parse(await fs.readFile(FILE, 'utf8'));
  } catch (err) {
    console.error(`読み込めません: ${path.relative(ROOT, FILE)} (${err.message})`);
    process.exitCode = 1;
    return;
  }

  check(isDate(data.verified_at), 'verified_at が YYYY-MM-DD ではありません');

  const src = data.pricing_source;
  check(src && typeof src === 'object', 'pricing_source がありません');
  check(typeof src?.name === 'string' && src.name.length > 0, 'pricing_source.name が空です');
  check(PRICING_KINDS.has(src?.kind), `pricing_source.kind が不正です: ${src?.kind}`);
  check(isHttps(src?.url), 'pricing_source.url が https URL ではありません');
  check(
    typeof src?.note === 'string' && src.note.length > 0,
    'pricing_source.note が空です（提供元の違いを説明してください）',
  );

  check(Array.isArray(data.models) && data.models.length > 0, 'models が空です');

  const ids = new Set();
  const sourceIds = new Set();
  let unverifiedCount = 0;

  for (const [i, m] of (data.models ?? []).entries()) {
    const at = `models[${i}]`;
    check(typeof m.id === 'string' && /^[a-z0-9-]+$/.test(m.id), `${at}.id が不正です`);
    check(typeof m.name === 'string' && m.name.length > 0, `${at}.name が空です`);
    check(typeof m.vendor === 'string' && m.vendor.length > 0, `${at}.vendor が空です`);
    check(TIERS.has(m.tier), `${at}.tier が不正です: ${m.tier}`);
    check(Number.isInteger(m.context) && m.context > 0, `${at}.context が不正です`);

    const price = m.pricing;
    check(price && typeof price === 'object', `${at}.pricing がありません`);
    check(typeof price?.input === 'number' && price.input >= 0, `${at}.pricing.input が不正です`);
    check(typeof price?.output === 'number' && price.output >= 0, `${at}.pricing.output が不正です`);
    check(price?.currency === 'USD', `${at}.pricing.currency が USD ではありません`);
    check(
      price?.unit === 'per_1m_tokens',
      `${at}.pricing.unit が per_1m_tokens ではありません`,
    );
    check(
      price?.conditions === null || (price?.conditions && typeof price.conditions === 'object'),
      `${at}.pricing.conditions は null かオブジェクトです（未確認は null）`,
    );

    check(
      m.open_weights === true || m.open_weights === false || m.open_weights === null,
      `${at}.open_weights は true / false / null のいずれかです`,
    );
    check(BASES.has(m.open_weights_basis), `${at}.open_weights_basis が不正です`);
    if (m.open_weights_basis === 'unverified') {
      check(
        m.open_weights === null,
        `${at}: 根拠が未確認なのに open_weights を断定しています`,
      );
      unverifiedCount += 1;
    } else {
      check(
        typeof m.open_weights === 'boolean',
        `${at}: 根拠があるなら open_weights は真偽値にしてください`,
      );
    }

    check(m.licence && typeof m.licence === 'object', `${at}.licence がありません`);
    check(
      m.licence?.name === null || typeof m.licence?.name === 'string',
      `${at}.licence.name は文字列か null です`,
    );
    check(
      typeof m.licence?.verified === 'boolean',
      `${at}.licence.verified が真偽値ではありません`,
    );
    if (m.licence?.verified) {
      check(
        typeof m.licence?.name === 'string' && m.licence.name.length > 0,
        `${at}: 確認済みのライセンスには名前が必要です`,
      );
    }

    check(
      typeof m.source_id === 'string' && m.source_id.includes('/'),
      `${at}.source_id が不正です`,
    );
    check(isHttps(m.source_url), `${at}.source_url が https URL ではありません`);
    check(
      typeof m.source_id === 'string' && String(m.source_url).includes(m.source_id),
      `${at}.source_url が source_id と対応していません`,
    );
    check(
      m.fetched_at === null || isDate(m.fetched_at),
      `${at}.fetched_at が YYYY-MM-DD か null ではありません`,
    );
    check(typeof m.note === 'string', `${at}.note が文字列ではありません`);

    check(!ids.has(m.id), `id が重複しています: ${m.id}`);
    check(!sourceIds.has(m.source_id), `source_id が重複しています: ${m.source_id}`);
    ids.add(m.id);
    sourceIds.add(m.source_id);
  }

  // 評価軸の表はモデル一覧の source_id を参照するので、モデル側の検証と続けて見る。
  // --staging は取得直後のモデル一覧だけを持つので、スナップショットは対象外。
  const snapshot = STAGING ? null : await validateSnapshot(sourceIds);

  if (errors.length) {
    console.error(`検証に失敗しました: ${path.relative(ROOT, FILE)}`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exitCode = 1;
    return;
  }

  const ageDays = Math.floor(
    (Date.now() - new Date(`${data.verified_at}T00:00:00+09:00`).getTime()) /
      86_400_000,
  );
  console.log(`OK: ${path.relative(ROOT, FILE)}`);
  console.log(`  models: ${data.models.length}（重み未確認: ${unverifiedCount}件）`);
  console.log(`  verified_at: ${data.verified_at}（${ageDays}日前）`);
  console.log(`  pricing_source: ${data.pricing_source.name}（${data.pricing_source.kind}）`);
  if (ageDays > 90) {
    console.warn('  警告: 確認日から90日を超えています。fetch:models で差分を確認してください。');
  }

  if (snapshot) {
    const reviewAfter = 90;
    const snapshotAge = Math.floor(
      (Date.now() - new Date(`${snapshot.captured_at}T00:00:00+09:00`).getTime()) / 86_400_000,
    );
    console.log(`OK: ${snapshot.rel}`);
    console.log(
      `  axes: ${snapshot.axes}（確認済み: ${snapshot.verifiedCount}件、未確認: ${snapshot.pendingCount}件）`,
    );
    console.log(`  captured_at: ${snapshot.captured_at}（${snapshotAge}日前）`);
    if (snapshotAge > reviewAfter) {
      console.warn(
        `  警告: 記録日から${reviewAfter}日を超えています。再取得し、人が承認してから公開してください。`,
      );
    }
  } else if (STAGING) {
    console.log('  capability-snapshots.json: --staging のため検証しません');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

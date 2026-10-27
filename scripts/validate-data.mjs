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
const FILE = process.argv.includes('--staging')
  ? path.join(ROOT, 'data/staging/model-comparison.json')
  : path.join(ROOT, 'data/model-comparison.json');

const TIERS = new Set(['frontier', 'balanced', 'light']);
const PRICING_KINDS = new Set(['official', 'reseller']);
const BASES = new Set(['curated', 'hugging-face-id', 'unverified']);
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
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

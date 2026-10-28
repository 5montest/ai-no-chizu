#!/usr/bin/env node
/**
 * AI図鑑のデータを検証する。
 *   npm run validate:zukan
 *
 * 見るのは形式と整合性で、値そのものの正しさは人が一次資料で確かめる。
 * 特に「未確認を 0 や false として書いていないか」「同じ数値を2か所に置いていないか」
 * 「既存のモデル比較データと食い違っていないか」を機械的に確認する。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { findModelMismatches } from '../src/lib/zukan.mjs';

const ROOT = process.cwd();
const FILE = path.join(ROOT, 'data/zukan.json');
const PRICING_FILE = path.join(ROOT, 'data/zukan-pricing.json');
const COMPARISON_FILE = path.join(ROOT, 'data/model-comparison.json');
const SNAPSHOT_FILE = path.join(ROOT, 'data/capability-snapshots.json');

const AVAILABILITY = new Set(['available', 'limited', 'preview', 'retired', 'unverified']);
const VERIFICATION = new Set(['official', 'reseller-only', 'partial', 'unverified']);
const COST_MODELS = new Set(['free', 'paid', 'usage-based', 'mixed', 'unknown']);
const CAPABILITY = new Set(['yes', 'no', 'unknown', 'n/a']);
const CAPABILITY_FIELDS = [
  'tool_support',
  'skills',
  'plugins',
  'mcp',
  'subagents',
  'plan_mode',
  'permissions',
];
const CONTEXT_BASES = new Set(['official', 'reseller', 'unverified']);
const HISTORY_STATUSES = new Set(['retired', 'renamed', 'merged']);
const SNAPSHOT_KINDS = new Set(['subscription', 'subscription-quota', 'token-price']);
const UNITS = new Set(['per_month', 'per_1m_tokens', 'per_request']);
const SOURCE_KINDS = new Set(['official', 'reseller']);
const MODEL_ID_STATUSES = new Set(['official', 'reseller-only', 'partial', 'unverified']);

const PRICE_REVIEW_DAYS = 30;
const SPEC_REVIEW_DAYS = 90;

const errors = [];
const warnings = [];

function check(condition, message) {
  if (!condition) errors.push(message);
}

function warn(condition, message) {
  if (condition) warnings.push(message);
}

const isDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const isHttps = (value) => typeof value === 'string' && value.startsWith('https://');
const isSlug = (value) => typeof value === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value);
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const isMoney = (value) => value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0);

function daysSince(date) {
  const then = new Date(`${date}T00:00:00+09:00`).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

/** 分類・用途などの語彙。id の重複と空ラベルを見る。 */
function validateTaxonomy(zukan) {
  const collect = (key) => {
    const items = zukan[key];
    check(Array.isArray(items) && items.length > 0, `zukan.json: ${key} が空です`);
    if (!Array.isArray(items)) return [];
    const ids = new Set();
    for (const item of items) {
      check(isSlug(item.id), `zukan.json: ${key} の id が不正です (${item.id})`);
      check(!ids.has(item.id), `zukan.json: ${key} の id が重複しています (${item.id})`);
      check(isNonEmptyString(item.label), `zukan.json: ${key}.${item.id} に label がありません`);
      ids.add(item.id);
    }
    return [...ids];
  };
  return {
    kinds: collect('kinds'),
    useCases: collect('use_cases'),
    interfaces: collect('interfaces'),
    platforms: collect('platforms'),
    accessRoutes: collect('access_routes'),
  };
}

function validateEntity(entity, vocab, snapshotIds) {
  const at = `zukan.json: entity ${entity.id ?? '(id なし)'}`;
  for (const field of ['id', 'slug', 'display_name', 'vendor', 'kind', 'availability_status', 'verification_status', 'cost_model']) {
    check(isNonEmptyString(entity[field]), `${at}: ${field} がありません`);
  }
  check(isSlug(entity.slug), `${at}: slug の形式が不正です (${entity.slug})`);
  check(entity.id === entity.slug, `${at}: id と slug が一致していません`);
  check(vocab.kinds.includes(entity.kind), `${at}: kind が語彙にありません (${entity.kind})`);
  check(AVAILABILITY.has(entity.availability_status), `${at}: availability_status が不正です`);
  check(VERIFICATION.has(entity.verification_status), `${at}: verification_status が不正です`);
  check(COST_MODELS.has(entity.cost_model), `${at}: cost_model が不正です`);

  const subset = (values, list, name) => {
    check(Array.isArray(values), `${at}: ${name} が配列ではありません`);
    if (!Array.isArray(values)) return;
    for (const value of values) {
      check(list.includes(value), `${at}: ${name} に語彙外の値があります (${value})`);
    }
  };
  subset(entity.primary_use_cases, vocab.useCases, 'primary_use_cases');
  subset(entity.interfaces, vocab.interfaces, 'interfaces');
  subset(entity.platforms, vocab.platforms, 'platforms');
  subset(entity.available_via, vocab.accessRoutes, 'available_via');

  for (const field of ['strengths', 'limitations', 'not_suitable_for']) {
    check(Array.isArray(entity[field]), `${at}: ${field} が配列ではありません`);
  }

  for (const field of CAPABILITY_FIELDS) {
    if (entity[field] === undefined) continue;
    check(CAPABILITY.has(entity[field]), `${at}: ${field} は yes/no/unknown/n/a のいずれかです (${entity[field]})`);
  }

  // 出典。URL が無い出典は、確認日を書いていても検証できない。
  check(Array.isArray(entity.sources) && entity.sources.length > 0, `${at}: sources が空です`);
  for (const [index, source] of (entity.sources ?? []).entries()) {
    check(isNonEmptyString(source.title), `${at}: sources[${index}].title がありません`);
    check(isHttps(source.url), `${at}: sources[${index}].url が https ではありません`);
    check(isNonEmptyString(source.publisher), `${at}: sources[${index}].publisher がありません`);
    check(isNonEmptyString(source.note), `${at}: sources[${index}].note がありません`);
  }
  check(isHttps(entity.official_url), `${at}: official_url が https ではありません`);
  check(isDate(entity.last_verified_at), `${at}: last_verified_at が YYYY-MM-DD ではありません`);
  check(isDate(entity.last_checked_at), `${at}: last_checked_at が YYYY-MM-DD ではありません`);

  for (const [index, modelId] of (entity.model_ids ?? []).entries()) {
    const where = `${at}: model_ids[${index}]`;
    check(isNonEmptyString(modelId.provider), `${where}.provider がありません`);
    check(isNonEmptyString(modelId.id), `${where}.id がありません`);
    check(isNonEmptyString(modelId.environment), `${where}.environment がありません`);
    check(MODEL_ID_STATUSES.has(modelId.verification_status), `${where}.verification_status が不正です`);
    check(isDate(modelId.verified_at), `${where}.verified_at が YYYY-MM-DD ではありません`);
    check(isNonEmptyString(modelId.note), `${where}.note がありません`);
  }

  if (entity.context_window !== null) {
    check(typeof entity.context_window === 'object', `${at}: context_window は null かオブジェクトです`);
    const window = entity.context_window ?? {};
    check(
      Number.isInteger(window.tokens) && window.tokens > 0,
      `${at}: context_window.tokens は正の整数です（未確認は null）`,
    );
    check(CONTEXT_BASES.has(window.basis), `${at}: context_window.basis が不正です`);
    check(isNonEmptyString(window.note), `${at}: context_window.note がありません`);
  }

  for (const id of entity.pricing_snapshot_ids ?? []) {
    check(snapshotIds.includes(id), `${at}: pricing_snapshot_ids に存在しないスナップショットがあります (${id})`);
  }

  if (entity.verification_status === 'official') {
    warn(
      !(entity.sources ?? []).some((source) => source.url && source.url === entity.official_url),
      `${at}: verification_status は official ですが、official_url が sources に含まれていません`,
    );
  }

  const age = daysSince(entity.last_checked_at);
  warn(
    age !== null && age > SPEC_REVIEW_DAYS,
    `${at}: 確認日から${age}日経っています（仕様の目安は${SPEC_REVIEW_DAYS}日）`,
  );
}

/** 料金スナップショット。単位・通貨・条件・参照先の整合性を見る。 */
function validatePricing(pricing, entityIds, comparison, externalFiles) {
  check(pricing.schema_version === 1, 'zukan-pricing.json: schema_version が 1 ではありません');
  check(isDate(pricing.updated_at), 'zukan-pricing.json: updated_at が YYYY-MM-DD ではありません');

  const ids = new Set();
  for (const snapshot of pricing.snapshots ?? []) {
    const at = `zukan-pricing.json: ${snapshot.id ?? '(id なし)'}`;
    check(isSlug(snapshot.id), `${at}: id の形式が不正です`);
    check(!ids.has(snapshot.id), `${at}: id が重複しています`);
    ids.add(snapshot.id);

    check(SNAPSHOT_KINDS.has(snapshot.kind), `${at}: kind が不正です (${snapshot.kind})`);
    check(isNonEmptyString(snapshot.vendor), `${at}: vendor がありません`);
    check(isNonEmptyString(snapshot.product), `${at}: product がありません`);
    check(/^[A-Z]{3}$/.test(snapshot.currency ?? ''), `${at}: currency が ISO 4217 の3文字ではありません`);
    check(['excluded', 'included', 'unknown'].includes(snapshot.tax), `${at}: tax の値が不正です`);
    check(UNITS.has(snapshot.unit), `${at}: unit が不正です (${snapshot.unit})`);
    check(isDate(snapshot.fetched_at), `${at}: fetched_at が YYYY-MM-DD ではありません`);
    check(isNonEmptyString(snapshot.source?.title), `${at}: source.title がありません`);
    check(isHttps(snapshot.source?.url), `${at}: source.url が https ではありません`);
    check(isNonEmptyString(snapshot.source?.publisher), `${at}: source.publisher がありません`);
    check(SOURCE_KINDS.has(snapshot.source?.kind), `${at}: source.kind が不正です`);

    const age = daysSince(snapshot.fetched_at);
    warn(
      age !== null && age > PRICE_REVIEW_DAYS,
      `${at}: 取得日から${age}日経っています（価格・枠の目安は${PRICE_REVIEW_DAYS}日）`,
    );

    /** 単価は数値か null。数値でない文字列を混ぜない。 */
    const validateTier = (tier, where) => {
      check(isNonEmptyString(tier.condition), `${where}.condition がありません`);
      for (const key of ['input', 'output', 'cache_read', 'cache_write']) {
        if (tier[key] === undefined) continue;
        check(isMoney(tier[key]), `${where}.${key} は 0 以上の数値か null です (${tier[key]})`);
      }
      check(tier.input !== undefined && tier.output !== undefined, `${where}: input と output が必要です`);
    };

    for (const [index, rate] of (snapshot.rates ?? []).entries()) {
      const where = `${at}: rates[${index}]`;
      check(entityIds.has(rate.entity_id), `${where}.entity_id が entities にありません (${rate.entity_id})`);
      check(isNonEmptyString(rate.model_name), `${where}.model_name がありません`);
      check(Array.isArray(rate.tiers) && rate.tiers.length > 0, `${where}.tiers が空です`);
      for (const [tierIndex, tier] of (rate.tiers ?? []).entries()) {
        validateTier(tier, `${where}.tiers[${tierIndex}]`);
      }
    }

    for (const [index, limit] of (snapshot.model_limits ?? []).entries()) {
      const where = `${at}: model_limits[${index}]`;
      check(isNonEmptyString(limit.model_name), `${where}.model_name がありません`);
      check(isMoney(limit.monthly_limit_usd), `${where}.monthly_limit_usd は 0 以上の数値か null です`);
      for (const [tierIndex, tier] of (limit.tiers ?? []).entries()) {
        validateTier(tier, `${where}.tiers[${tierIndex}]`);
      }
    }

    for (const [index, plan] of (snapshot.plans ?? []).entries()) {
      const where = `${at}: plans[${index}]`;
      check(entityIds.has(plan.entity_id), `${where}.entity_id が entities にありません (${plan.entity_id})`);
      check(isNonEmptyString(plan.display_name), `${where}.display_name がありません`);
      // 月額は billing.monthly_usd（サブスクリプション）と直下の monthly_usd（枠付きプラン）の2形がある。
      const monthly = plan.billing ? plan.billing.monthly_usd : plan.monthly_usd;
      check(isMoney(monthly), `${where}: 月額が 0 以上の数値か null です`);
      for (const seat of plan.seats ?? []) {
        check(isMoney(seat.monthly_usd), `${where}.seats: monthly_usd が不正です`);
        check(isMoney(seat.annual_monthly_usd), `${where}.seats: annual_monthly_usd が不正です`);
      }
      for (const option of plan.selection ?? []) {
        check(isMoney(option.monthly_usd), `${where}.selection: monthly_usd が不正です`);
        check(isNonEmptyString(option.note), `${where}.selection: note がありません`);
      }
    }

    // 再販価格は複製せず、既存データを参照する。
    if (snapshot.external_ref) {
      const ref = snapshot.external_ref;
      check((snapshot.rates ?? []).length === 0, `${at}: external_ref があるのに rates に値を持っています（二重管理）`);
      const target = externalFiles[ref.path];
      check(Boolean(target), `${at}: external_ref.path を読み込めません (${ref.path})`);
      if (target) {
        check(
          (target.models ?? []).every((model) => model[ref.id_field]),
          `${at}: external_ref.id_field が参照先にありません (${ref.id_field})`,
        );
        check(
          (target.models ?? []).some((model) => entityIds.has(model.id)),
          `${at}: 参照先のどのモデル id も entities にありません`,
        );
      }
    }
  }

  // 図鑑のエンティティ側から参照される価格が実在するか（逆方向）。
  for (const entity of pricing.__entities ?? []) {
    if (entity.cost_model === 'unknown') continue;
    check(
      Array.isArray(entity.pricing_snapshot_ids) && entity.pricing_snapshot_ids.length > 0,
      `zukan.json: entity ${entity.id} は cost_model が ${entity.cost_model} ですが価格スナップショットを参照していません`,
    );
  }

  return ids;
}

/**
 * 図鑑と既存データの突き合わせ。
 *
 * 突き合わせの規則は src/lib/zukan.mjs に置き、テストと同じ関数を使う。
 * 検証スクリプトとテストで規則が食い違うと、どちらも信用できなくなる。
 */
function crossCheck(zukan, comparison, capabilities) {
  for (const message of findModelMismatches({ zukan, comparison, capabilities })) {
    errors.push(message);
  }
}

async function main() {
  let zukan;
  let pricing;
  let comparison;
  let capabilities;
  try {
    zukan = await readJson(FILE);
    pricing = await readJson(PRICING_FILE);
    comparison = await readJson(COMPARISON_FILE);
    capabilities = await readJson(SNAPSHOT_FILE);
  } catch (err) {
    console.error(`図鑑データを読み込めません: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  check(zukan.schema_version === 1, 'zukan.json: schema_version が 1 ではありません');
  check(isDate(zukan.updated_at), 'zukan.json: updated_at が YYYY-MM-DD ではありません');

  const vocab = validateTaxonomy(zukan);
  const snapshotIds = (pricing.snapshots ?? []).map((snapshot) => snapshot.id);
  const entityIds = new Set();
  const slugs = new Set();
  const seenModelIds = new Map();

  check(Array.isArray(zukan.entities) && zukan.entities.length > 0, 'zukan.json: entities が空です');
  for (const entity of zukan.entities ?? []) {
    check(!entityIds.has(entity.id), `zukan.json: entity id が重複しています (${entity.id})`);
    check(!slugs.has(entity.slug), `zukan.json: slug が重複しています (${entity.slug})`);
    entityIds.add(entity.id);
    slugs.add(entity.slug);
    validateEntity(entity, vocab, snapshotIds);

    for (const modelId of entity.model_ids ?? []) {
      const key = `${modelId.provider}:${modelId.id}`;
      check(
        !seenModelIds.has(key),
        `zukan.json: モデルID ${key} が ${seenModelIds.get(key)} と ${entity.id} で重複しています`,
      );
      seenModelIds.set(key, entity.id);
    }
  }

  for (const [index, entry] of (zukan.history ?? []).entries()) {
    const at = `zukan.json: history[${index}]`;
    check(HISTORY_STATUSES.has(entry.status), `${at}: status が不正です (${entry.status})`);
    check(isDate(entry.checked_at), `${at}: checked_at が YYYY-MM-DD ではありません`);
    check(isNonEmptyString(entry.note), `${at}: note がありません`);
    check(isNonEmptyString(entry.source?.url), `${at}: source.url がありません`);
    check(
      entry.entity_id === undefined || entityIds.has(entry.entity_id),
      `${at}: entity_id が entities にありません (${entry.entity_id})`,
    );
  }

  pricing.__entities = zukan.entities;
  validatePricing(pricing, entityIds, comparison, {
    'data/model-comparison.json': comparison,
  });
  delete pricing.__entities;

  crossCheck(zukan, comparison, capabilities);

  const counts = {};
  for (const entity of zukan.entities ?? []) {
    counts[entity.kind] = (counts[entity.kind] ?? 0) + 1;
  }
  const summary = Object.entries(counts)
    .map(([kind, count]) => `${kind} ${count}`)
    .join(' / ');

  for (const message of warnings) console.warn(`警告: ${message}`);
  if (errors.length > 0) {
    for (const message of errors) console.error(`エラー: ${message}`);
    console.error(`図鑑データ検証NG: ${errors.length}件`);
    process.exitCode = 1;
    return;
  }
  console.log(`図鑑データ検証OK: ${zukan.entities.length}件（${summary}）`);
  console.log(`  価格スナップショット: ${pricing.snapshots.length}件`);
  if (warnings.length > 0) console.log(`  警告: ${warnings.length}件（上記）`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

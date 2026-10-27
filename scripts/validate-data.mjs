#!/usr/bin/env node
/**
 * 公開データの形式を検証する。ビルド前とデータ更新後に実行する。
 *   npm run validate:data
 *   npm run validate:data -- --staging
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const FILE = process.argv.includes('--staging')
  ? path.join(ROOT, 'data/staging/model-comparison.json')
  : path.join(ROOT, 'data/model-comparison.json');

const TIERS = new Set(['frontier', 'balanced', 'light']);
const errors = [];

function check(condition, message) {
  if (!condition) errors.push(message);
}

function isDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
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
  check(typeof data.source === 'string' && data.source.length > 0, 'source が空です');
  check(
    typeof data.source_url === 'string' && data.source_url.startsWith('https://'),
    'source_url が https URL ではありません',
  );
  check(Array.isArray(data.models) && data.models.length > 0, 'models が空です');

  const ids = new Set();
  const sourceIds = new Set();
  for (const [i, m] of (data.models ?? []).entries()) {
    const at = `models[${i}]`;
    check(typeof m.id === 'string' && /^[a-z0-9-]+$/.test(m.id), `${at}.id が不正です`);
    check(typeof m.name === 'string' && m.name.length > 0, `${at}.name が空です`);
    check(typeof m.vendor === 'string' && m.vendor.length > 0, `${at}.vendor が空です`);
    check(TIERS.has(m.tier), `${at}.tier が不正です: ${m.tier}`);
    check(Number.isInteger(m.context) && m.context > 0, `${at}.context が不正です`);
    check(typeof m.input === 'number' && m.input >= 0, `${at}.input が不正です`);
    check(typeof m.output === 'number' && m.output >= 0, `${at}.output が不正です`);
    check(typeof m.open_weights === 'boolean', `${at}.open_weights が真偽値ではありません`);
    check(typeof m.source_id === 'string' && m.source_id.includes('/'), `${at}.source_id が不正です`);
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
  console.log(`  models: ${data.models.length}`);
  console.log(`  verified_at: ${data.verified_at}（${ageDays}日前）`);
  console.log(`  source: ${data.source}`);
  if (ageDays > 90) {
    console.warn('  警告: 確認日から90日を超えています。fetch:models で差分を確認してください。');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

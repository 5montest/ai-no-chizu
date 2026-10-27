#!/usr/bin/env node
/**
 * OpenRouter の公開モデル一覧から価格・コンテキスト長を取得し、
 * レビュー用の staging ファイルだけに書き出す。
 *
 * 公開データ（data/model-comparison.json）はこのスクリプトでは更新しない。
 * 差分を確認し、内容を承認した人が手動で昇格する。
 *
 * API に無いモデルは「取得できなかった」として記録するだけで、公開データからは消さない。
 * 料金は OpenRouter の基本単価であり、長文入力・キャッシュなどの条件付き料金や
 * 重みの公開可否は API から分からないため、人が確認するまで未確認のままにする。
 *
 * 使い方:
 *   npm run fetch:models
 *   npm run fetch:models -- --dry-run
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  PRICING_SOURCE,
  diffModels,
  mergeModels,
} from './lib/merge-model-data.mjs';

const ROOT = process.cwd();
const PUBLISHED = path.join(ROOT, 'data/model-comparison.json');
const STAGING_DIR = path.join(ROOT, 'data/staging');
const STAGING = path.join(STAGING_DIR, 'model-comparison.json');
const API = 'https://openrouter.ai/api/v1/models';

const DRY_RUN = process.argv.includes('--dry-run');

const TARGETS = [
  'anthropic/claude-fable-5.1',
  'anthropic/claude-opus-5.5',
  'anthropic/claude-sonnet-5.5',
  'anthropic/claude-haiku-5.5',
  'openai/gpt-6.1-sol-pro',
  'openai/gpt-6.1-terra-pro',
  'google/gemini-4-argon',
  'google/gemini-3.8-flash',
  'x-ai/grok-4.7',
  'deepseek/deepseek-v4.1-flash',
  'qwen/qwen3.8-27b',
  'qwen/qwen3.8-max-prime',
  'mistralai/mistral-large-4-0',
];

function todayJst() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  const today = todayJst();
  console.log(`OpenRouter からモデル一覧を取得: ${API}`);
  const res = await fetch(API, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`API 応答が ${res.status} ${res.statusText}`);
  const payload = await res.json();
  if (!Array.isArray(payload?.data)) throw new Error('API 応答に data 配列がありません');

  const apiModels = new Map(payload.data.map((m) => [m.id, m]));
  const published = await readJson(PUBLISHED);

  const { models, unavailable, carried } = mergeModels({
    targets: TARGETS,
    apiModels,
    published,
    today,
    onHint: (line) => console.log(`  ※ ${line}`),
  });

  const output = {
    // verified_at は人が内容を承認した日。機械取得では進めない。
    verified_at: published?.verified_at ?? today,
    pricing_source: published?.pricing_source ?? PRICING_SOURCE,
    method:
      published?.method ??
      '公開APIのモデル一覧から代表的なモデルを抜粋し、コンテキスト長と基本のトークン単価を記録した。能力・品質の順位は含まない。',
    note:
      'price は基本料金のみ。長文入力・キャッシュ・バッチなどの条件付き料金は未確認（conditions: null）として扱う。重みの公開可否とライセンスは提供元の配布条件で決まるため、未確認の項目はそのまま未確認として残す。',
    models,
  };

  console.log(`取得: ${models.length}件 / 取得できず: ${unavailable.length}件`);
  for (const line of unavailable) console.warn(`  - 未取得: ${line}`);

  const changes = diffModels({ models, published, carried });
  console.log(changes.length ? '公開データとの差分:' : '公開データとの差分: なし');
  for (const line of changes) console.log(`  - ${line}`);

  if (DRY_RUN) {
    console.log('--dry-run のため書き込みません。');
    return;
  }

  await fs.mkdir(STAGING_DIR, { recursive: true });
  await fs.writeFile(STAGING, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`staging に書き出しました: ${path.relative(ROOT, STAGING)}`);
  console.log(
    '差分と未確認項目を確認し、必要なら verified_at を今日の日付にしてから data/model-comparison.json へ昇格してください。',
  );
}

main().catch((err) => {
  console.error(`取得に失敗しました: ${err.message}`);
  process.exitCode = 1;
});

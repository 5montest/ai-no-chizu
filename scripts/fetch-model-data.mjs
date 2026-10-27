#!/usr/bin/env node
/**
 * OpenRouter の公開モデル一覧から価格・コンテキスト長を取得し、
 * レビュー用の staging ファイルだけに書き出す。
 *
 * 公開データ（data/model-comparison.json）はこのスクリプトでは更新しない。
 * 差分を確認し、内容を承認した人が手動で昇格する。
 *
 * 使い方:
 *   npm run fetch:models
 *   npm run fetch:models -- --dry-run
 */
import fs from 'node:fs/promises';
import path from 'node:path';

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

function toPerMillion(value) {
  const n = Number(value) * 1_000_000;
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 1000) / 1000;
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  console.log(`OpenRouter からモデル一覧を取得: ${API}`);
  const res = await fetch(API, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`API 応答が ${res.status} ${res.statusText}`);
  const payload = await res.json();
  if (!Array.isArray(payload?.data)) throw new Error('API 応答に data 配列がありません');

  const byId = new Map(payload.data.map((m) => [m.id, m]));
  const published = await readJson(PUBLISHED);
  const noteById = new Map(
    (published?.models ?? []).map((m) => [m.source_id, m.note]),
  );

  const models = [];
  const missing = [];
  for (const sourceId of TARGETS) {
    const raw = byId.get(sourceId);
    if (!raw) {
      missing.push(sourceId);
      continue;
    }
    const input = toPerMillion(raw.pricing?.prompt);
    const output = toPerMillion(raw.pricing?.completion);
    if (input === null || output === null) {
      missing.push(`${sourceId}（価格が不正）`);
      continue;
    }
    const prev = published?.models?.find((m) => m.source_id === sourceId);
    const id = prev?.id ?? sourceId.split('/').pop().replaceAll('.', '-');
    models.push({
      id,
      name: raw.name.replace(/^[^:]+:\s*/, ''),
      vendor: prev?.vendor ?? raw.name.split(':')[0],
      tier: prev?.tier ?? 'balanced',
      context: raw.context_length,
      input,
      output,
      open_weights: Boolean(raw.hugging_face_id) || Boolean(prev?.open_weights),
      note: noteById.get(sourceId) ?? '',
      source_id: sourceId,
    });
  }

  const output = {
    verified_at: todayJst(),
    source: 'OpenRouter Models API',
    source_url: API,
    method:
      '公開APIのモデル一覧から代表的なモデルを抜粋し、コンテキスト長とトークン単価を記録した。能力・品質の順位は含まない。',
    note: published?.note ?? '',
    models,
  };

  console.log(`取得: ${models.length}件 / 未取得: ${missing.length}件`);
  for (const id of missing) console.warn(`  - 未取得: ${id}`);

  const changes = [];
  for (const m of models) {
    const prev = published?.models?.find((p) => p.source_id === m.source_id);
    if (!prev) {
      changes.push(`追加: ${m.name}`);
      continue;
    }
    for (const key of ['context', 'input', 'output']) {
      if (prev[key] !== m[key]) {
        changes.push(`変更: ${m.name} ${key} ${prev[key]} → ${m[key]}`);
      }
    }
  }
  console.log(changes.length ? '公開データとの差分:' : '公開データとの差分: なし');
  for (const line of changes) console.log(`  - ${line}`);

  if (DRY_RUN) {
    console.log('--dry-run のため書き込みません。');
    return;
  }

  await fs.mkdir(STAGING_DIR, { recursive: true });
  await fs.writeFile(STAGING, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`staging に書き出しました: ${path.relative(ROOT, STAGING)}`);
  console.log('内容と差分を確認してから data/model-comparison.json へ昇格してください。');
}

main().catch((err) => {
  console.error(`取得に失敗しました: ${err.message}`);
  process.exitCode = 1;
});

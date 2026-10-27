import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  diffModels,
  mergeModels,
  prevPricing,
  toPerMillion,
} from '../scripts/lib/merge-model-data.mjs';

/**
 * モデルデータの取り込み処理のテスト。
 *
 * 実際に起きた問題は「API 応答に無いモデルを黙って落とす」「Hugging Face ID が
 * あるだけで重み公開と判定する」の2つ。どちらもネットワークを使わずに再現できる。
 */

// API の pricing はトークンあたりの文字列。テストは公開データと同じ
// 「100万トークンあたり」の数値で書き、ここで API 側の形に直す。
function apiModel(id: string, name: string, perMillionInput: number, perMillionOutput: number) {
  return {
    id,
    name,
    context_length: 1_000_000,
    pricing: {
      prompt: String(perMillionInput / 1_000_000),
      completion: String(perMillionOutput / 1_000_000),
    },
  };
}

const PUBLISHED = {
  verified_at: '2026-10-27',
  pricing_source: { name: 'OpenRouter Models API', kind: 'reseller', url: 'https://openrouter.ai/api/v1/models', note: 'x' },
  models: [
    {
      id: 'kept-model',
      name: 'Kept',
      vendor: 'Vendor',
      tier: 'balanced',
      context: 128_000,
      pricing: { input: 1, output: 2, currency: 'USD', unit: 'per_1m_tokens', conditions: null },
      open_weights: true,
      open_weights_basis: 'curated',
      licence: { name: null, verified: false },
      note: 'ひとこと',
      source_id: 'vendor/kept-model',
      source_url: 'https://openrouter.ai/vendor/kept-model',
      fetched_at: '2026-10-20',
    },
  ],
};

test('API に無いモデルを消さない', () => {
  const { models, unavailable, carried } = mergeModels({
    targets: ['vendor/kept-model'],
    apiModels: new Map(),
    published: PUBLISHED,
    today: '2026-10-28',
  });
  assert.equal(models.length, 1);
  assert.equal(models[0].id, 'kept-model');
  assert.equal(models[0].context, 128_000);
  assert.equal(models[0].fetched_at, '2026-10-20', '取得できていないのに取得日を進めない');
  assert.deepEqual([...carried], ['vendor/kept-model']);
  assert.match(unavailable[0], /API に見つからない/);
});

test('新規モデルは Hugging Face ID があっても重み公開と決めない', () => {
  const raw = { ...apiModel('vendor/new', 'New', 0.5, 1.5), hugging_face_id: 'vendor/new' };
  const hints: string[] = [];
  const { models } = mergeModels({
    targets: ['vendor/new'],
    apiModels: new Map([['vendor/new', raw]]),
    published: { ...PUBLISHED, models: [] },
    today: '2026-10-28',
    onHint: (line: string) => hints.push(line),
  });
  assert.equal(models[0].open_weights, null);
  assert.equal(models[0].open_weights_basis, 'unverified');
  assert.equal(models[0].licence.verified, false);
  assert.equal(hints.length, 1, '人に確認を促す');
});

test('新規モデルの条件付き料金は未確認のまま', () => {
  const { models } = mergeModels({
    targets: ['vendor/new'],
    apiModels: new Map([['vendor/new', apiModel('vendor/new', 'New', 1, 2)]]),
    published: { ...PUBLISHED, models: [] },
    today: '2026-10-28',
  });
  assert.equal(models[0].pricing.conditions, null);
  assert.equal(models[0].pricing.currency, 'USD');
  assert.equal(models[0].pricing.unit, 'per_1m_tokens');
  assert.match(models[0].source_url, /openrouter\.ai\/vendor\/new/);
});

test('単価は100万トークンあたりに換算し、既存の丸めを保つ', () => {
  assert.equal(toPerMillion('0.00000014'), 0.14);
  assert.equal(toPerMillion('0.000001'), 1);
  assert.equal(toPerMillion(''), null);
  assert.equal(toPerMillion('-1'), null);
});

test('値が壊れた応答は採用せず既存値を残す', () => {
  const broken = { id: 'vendor/kept-model', name: 'Kept', context_length: 0, pricing: { prompt: '1', completion: '2' } };
  const { models, carried } = mergeModels({
    targets: ['vendor/kept-model'],
    apiModels: new Map([['vendor/kept-model', broken]]),
    published: PUBLISHED,
    today: '2026-10-28',
  });
  assert.equal(models[0].context, 128_000);
  assert.equal(carried.has('vendor/kept-model'), true);
});

test('差分は価格とコンテキストの変化として読める', () => {
  const { models } = mergeModels({
    targets: ['vendor/kept-model'],
    apiModels: new Map([['vendor/kept-model', apiModel('vendor/kept-model', 'Kept', 1.5, 2)]]),
    published: PUBLISHED,
    today: '2026-10-28',
  });
  const diff = diffModels({ models, published: PUBLISHED });
  assert.ok(diff.some((line) => line.includes('input 1 → 1.5')));
  assert.ok(diff.some((line) => line.includes('context 128000 → 1000000')));
});

test('旧形式（input/output 直書き）の公開データも読める', () => {
  assert.deepEqual(prevPricing({ input: 2, output: 5 }), {
    input: 2,
    output: 5,
    currency: 'USD',
    unit: 'per_1m_tokens',
    conditions: null,
  });
});

test('公開データそのものが新しい形になっている', () => {
  const data = JSON.parse(
    fs.readFileSync(new URL('../data/model-comparison.json', import.meta.url), 'utf8'),
  );
  assert.equal(data.pricing_source.kind, 'reseller');
  for (const model of data.models) {
    assert.equal(model.pricing.currency, 'USD', `${model.id}: currency`);
    assert.equal(model.pricing.unit, 'per_1m_tokens', `${model.id}: unit`);
    assert.match(model.source_url, new RegExp(model.source_id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    if (model.open_weights === null) assert.equal(model.open_weights_basis, 'unverified');
    else assert.notEqual(model.open_weights_basis, 'unverified');
  }
});

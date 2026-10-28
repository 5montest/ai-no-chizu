import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { findModelMismatches } from '../src/lib/zukan.mjs';
import type { ModelComparison, Zukan, ZukanPricing } from '../src/lib/zukan-types';

/**
 * 図鑑データと既存データの整合性テスト。
 *
 * 形式の網羅的な検証は scripts/validate-zukan.mjs が受け持つ。
 * ここでは、サイト内で同じ事実がずれたときに気づけることに絞る。
 * 特に、再販価格を model-comparison.json に一本化した前提が崩れていないか。
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const readJson = (rel: string) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

const zukan: Zukan = readJson('data/zukan.json');
const pricing: ZukanPricing = readJson('data/zukan-pricing.json');
const comparison: ModelComparison = readJson('data/model-comparison.json');
const capabilities = readJson('data/capability-snapshots.json');

const entityIds = new Set(zukan.entities.map((entity) => entity.id));
const snapshotIds = new Set(pricing.snapshots.map((snapshot) => snapshot.id));

/**
 * 条件に合う項目を取り出す。見つからなければテストを失敗させる。
 * 「合う項目がある」こと自体を前提にしている検査で、undefined を握りつぶさないため。
 */
const mustFind = <T>(items: readonly T[], predicate: (item: T) => boolean, label: string): T => {
  const found = items.find(predicate);
  assert.ok(found, label);
  return found;
};

test('IDと slug は重複せず、一致している', () => {
  const ids = zukan.entities.map((entity) => entity.id);
  const slugs = zukan.entities.map((entity) => entity.slug);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const entity of zukan.entities) {
    assert.equal(entity.id, entity.slug, `${entity.id} の id と slug が違う`);
  }
});

test('すべてのエンティティに出典URLと確認日がある', () => {
  for (const entity of zukan.entities) {
    assert.ok(entity.sources.length > 0, `${entity.id} に出典がない`);
    for (const source of entity.sources) {
      assert.ok(source.url, `${entity.id} に出典URLがない`);
      assert.match(source.url, /^https:\/\//, `${entity.id} の出典URLが https ではない`);
      assert.ok(source.note, `${entity.id} の出典に note がない`);
    }
    assert.match(entity.last_checked_at, /^\d{4}-\d{2}-\d{2}$/, `${entity.id} の確認日が不正`);
  }
});

test('料金スナップショットの参照先が実在する', () => {
  for (const entity of zukan.entities) {
    for (const id of entity.pricing_snapshot_ids) {
      assert.ok(snapshotIds.has(id), `${entity.id} が存在しないスナップショット ${id} を参照している`);
    }
  }
});

test('課金があると分かっているものは価格スナップショットを参照する', () => {
  for (const entity of zukan.entities) {
    if (entity.cost_model === 'unknown') continue;
    assert.ok(
      entity.pricing_snapshot_ids.length > 0,
      `${entity.id} は cost_model=${entity.cost_model} なのに価格の参照先がない`,
    );
  }
});

test('再販価格は model-comparison.json に一本化され、図鑑側に複製がない', () => {
  for (const snapshot of pricing.snapshots) {
    if (!snapshot.external_ref) continue;
    assert.equal(
      (snapshot.rates ?? []).length,
      0,
      `${snapshot.id} が外部参照と自前の料金を併記している`,
    );
    assert.equal(snapshot.external_ref.path, 'data/model-comparison.json');
  }
});

test('図鑑とモデル比較表・能力スナップショットは食い違っていない', () => {
  assert.deepEqual(findModelMismatches({ zukan, comparison, capabilities }), []);
});

test('モデル比較表の全モデルに図鑑のエンティティがある', () => {
  for (const model of comparison.models) {
    assert.ok(entityIds.has(model.id), `model-comparison.json の ${model.id} が図鑑にない`);
  }
});

test('廃止した製品は消さず、履歴に残して既存エンティティへつなぐ', () => {
  assert.ok(zukan.history.length > 0, '履歴が空');
  for (const entry of zukan.history) {
    assert.ok(entityIds.has(entry.entity_id), `履歴 ${entry.id} の参照先 ${entry.entity_id} がない`);
    assert.ok(entry.note, `履歴 ${entry.id} に説明がない`);
  }
});

test('再販ID・文脈長・入力モダリティのずれを検出する', () => {
  const broken = structuredClone({ zukan, comparison, capabilities });

  // 再販IDの取り違え
  const modelEntity = mustFind(
    broken.zukan.entities,
    (entity) => (entity.model_ids ?? []).some((modelId) => modelId.provider === 'OpenRouter'),
    'OpenRouter を再販に持つエンティティがない',
  );
  const resellerModelId = mustFind(
    modelEntity.model_ids,
    (modelId) => modelId.provider === 'OpenRouter',
    'OpenRouter のモデルIDがない',
  );
  resellerModelId.id = 'someone/other-model';
  assert.ok(
    findModelMismatches(broken).some((message) => message.includes('OpenRouter ID')),
    '再販IDのずれを検出できていない',
  );

  // 図鑑にないモデル
  const withExtra = structuredClone({ zukan, comparison, capabilities });
  withExtra.comparison.models.push({ ...withExtra.comparison.models[0], id: 'not-in-zukan' });
  assert.ok(
    findModelMismatches(withExtra).some((message) => message.includes('not-in-zukan')),
    '対応するエンティティの欠落を検出できていない',
  );

  // 文脈長のずれ（再販の値をもとにしている場合のみ突き合わせる）
  const resellerContext = structuredClone({ zukan, comparison, capabilities });
  const target = mustFind(
    resellerContext.zukan.entities,
    (entity) => entity.context_window?.basis === 'reseller',
    '文脈長の根拠が reseller のエンティティがない',
  );
  assert.ok(target.context_window, `${target.id} に文脈長がない`);
  target.context_window.tokens += 1;
  assert.ok(
    findModelMismatches(resellerContext).some((message) => message.includes('文脈長')),
    '文脈長のずれを検出できていない',
  );

  // 入力モダリティのずれ
  const modality = structuredClone({ zukan, comparison, capabilities });
  const withModalities = mustFind(
    modality.zukan.entities,
    (entity) => entity.input_modalities !== null && (entity.model_ids ?? []).length > 0,
    '入力モダリティとモデルIDを持つエンティティがない',
  );
  withModalities.input_modalities = ['text'];
  assert.ok(
    findModelMismatches(modality).some((message) => message.includes('入力モダリティ')),
    '入力モダリティのずれを検出できていない',
  );
});

test('料金の単位と通貨が書かれている', () => {
  for (const snapshot of pricing.snapshots) {
    assert.equal(snapshot.currency, 'USD', `${snapshot.id} の通貨がUSD以外`);
    assert.ok(snapshot.unit, `${snapshot.id} に課金単位がない`);
    assert.match(snapshot.fetched_at, /^\d{4}-\d{2}-\d{2}$/, `${snapshot.id} の取得日が不正`);
    assert.ok(snapshot.source?.url, `${snapshot.id} に出典URLがない`);
  }
});

test('確認できていない単価は null で保持し、文字列を混ぜていない', () => {
  for (const snapshot of pricing.snapshots) {
    for (const rate of snapshot.rates ?? []) {
      for (const tier of rate.tiers) {
        const keys = ['input', 'output', 'cache_read', 'cache_write'] as const;
        for (const key of keys) {
          const value = tier[key];
          assert.ok(
            value === undefined || value === null || typeof value === 'number',
            `${snapshot.id} / ${rate.model_name} の ${key} が数値でも null でもない`,
          );
        }
      }
    }
  }
});

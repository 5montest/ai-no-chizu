import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  MODALITY_ORDER,
  formatJapaneseDate,
  formatModalities,
  formatReasoning,
  sortModelsByVendorName,
} from '../src/lib/capability.ts';

/**
 * 評価軸スナップショットのテスト。
 *
 * 表はビルド時に HTML へ焼き込むので、軸の欠落や値の取り違えは
 * 画面を見ないと気づけない。データの約束と、表示の約束を先に見る。
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const readText = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const readJson = (rel: string) => JSON.parse(readText(rel));

type Value = { model_id: string; value: Record<string, unknown> };

type Axis = {
  id: string;
  label: string;
  kind: 'spec' | 'benchmark';
  render?: 'modality' | 'reasoning';
  status: 'verified' | 'unverified';
  metric: string | null;
  benchmark: string | null;
  conditions: string | null;
  measured_at: string | null;
  source: { name: string; url: string; field: string } | null;
  values: Value[];
  note?: string;
  candidate_benchmarks?: string[];
  needs?: string[];
};

const snapshot = readJson('data/capability-snapshots.json') as {
  schema_version: number;
  captured_at: string;
  source: { name: string; url: string };
  policy: {
    publish_rule: string;
    ordering: string;
    price_separation: string;
    freshness: { review_after_days: number; display_rule: string; stale_rule: string };
  };
  axes: Axis[];
};

const models = (
  readJson('data/model-comparison.json') as {
    models: {
      id: string;
      name: string;
      vendor: string;
      source_id: string;
      pricing: { input: number; output: number };
    }[];
  }
).models;

const verified = snapshot.axes.filter((axis) => axis.status === 'verified');
const pending = snapshot.axes.filter((axis) => axis.status !== 'verified');

test('記録日と出典URLの形式が揃っている', () => {
  assert.match(snapshot.captured_at, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(snapshot.source.url, /^https:\/\//);
  assert.equal(formatJapaneseDate(snapshot.captured_at), '2026年10月28日');
  for (const axis of snapshot.axes) {
    if (axis.measured_at) assert.match(axis.measured_at, /^\d{4}-\d{2}-\d{2}$/);
    if (axis.source) assert.match(axis.source.url, /^https:\/\//);
  }
});

test('軸のIDと見出しは重複しない', () => {
  const ids = snapshot.axes.map((axis) => axis.id);
  const labels = snapshot.axes.map((axis) => axis.label);
  assert.equal(new Set(ids).size, ids.length, `軸のIDが重複しています: ${ids.join(', ')}`);
  assert.equal(new Set(labels).size, labels.length, `軸の見出しが重複しています: ${labels.join(', ')}`);
  assert.ok(verified.length >= 1, '確認済みの軸がありません');
  assert.ok(pending.length >= 1, '未確認の軸がありません');
});

test('確認済みの軸は、指標・条件・記録日・出典の欄が埋まっている', () => {
  for (const axis of verified) {
    assert.ok(axis.metric, `${axis.label}: 指標がありません`);
    assert.ok(axis.conditions, `${axis.label}: 条件がありません`);
    assert.ok(axis.measured_at, `${axis.label}: 記録日がありません`);
    assert.ok(axis.source?.name, `${axis.label}: 出典名がありません`);
    assert.ok(axis.source?.field, `${axis.label}: 出典の項目がありません`);
    assert.match(axis.source?.url ?? '', /^https:\/\//, `${axis.label}: 出典URLが不正です`);
    // 仕様の軸にベンチマーク名を書くと、能力の測定値に見える。
    assert.equal(axis.benchmark, null, `${axis.label}: 仕様の軸にベンチマーク名があります`);
    assert.ok(axis.render, `${axis.label}: 表示方法（render）がありません`);
  }
});

test('確認済みの軸は、すべてのモデルの値を1件ずつ持つ', () => {
  const expected = models.map((model) => model.source_id).sort();
  for (const axis of verified) {
    const ids = axis.values.map((entry) => entry.model_id);
    assert.equal(new Set(ids).size, ids.length, `${axis.label}: 同じモデルの値が重複しています`);
    assert.deepEqual(ids.slice().sort(), expected, `${axis.label}: 値の並びがモデル一覧と一致しません`);
  }
});

test('未確認の軸は、数値も出典も持たない', () => {
  for (const axis of pending) {
    assert.deepEqual(axis.values, [], `${axis.label}: 未確認の軸に値があります`);
    assert.equal(axis.metric, null, `${axis.label}: 未確認の軸に指標があります`);
    assert.equal(axis.benchmark, null, `${axis.label}: 未確認の軸にベンチマーク名があります`);
    assert.equal(axis.conditions, null, `${axis.label}: 未確認の軸に条件があります`);
    assert.equal(axis.measured_at, null, `${axis.label}: 未確認の軸に記録日があります`);
    assert.equal(axis.source, null, `${axis.label}: 未確認の軸に出典があります`);
    assert.ok(axis.note, `${axis.label}: 未確認の理由がありません`);
    assert.ok((axis.needs ?? []).length > 0, `${axis.label}: 公開に必要な項目がありません`);
    assert.ok((axis.candidate_benchmarks ?? []).length > 0, `${axis.label}: 候補の指標がありません`);
  }
});

test('入出力の種類は決めた表記だけを使う', () => {
  const axis = verified.find((item) => item.render === 'modality');
  assert.ok(axis, '入力モダリティの軸がありません');
  for (const entry of axis.values) {
    const input = entry.value.input as string[];
    const output = entry.value.output as string[];
    assert.ok(input.includes('text'), `${entry.model_id}: テキスト入力がありません`);
    for (const code of [...input, ...output]) {
      assert.ok(MODALITY_ORDER.includes(code), `${entry.model_id}: 未知の入力種別 ${code}`);
    }
  }
  assert.equal(formatModalities(['file', 'text', 'image']), 'テキスト・画像・ファイル');
});

test('推論の設定は、選べる effort の中に既定値がある', () => {
  const axis = verified.find((item) => item.render === 'reasoning');
  assert.ok(axis, '推論の切り替えの軸がありません');
  for (const entry of axis.values) {
    const value = entry.value as {
      mandatory: boolean;
      default_effort: string;
      supported_efforts: string[];
    };
    assert.ok(
      value.supported_efforts.includes(value.default_effort),
      `${entry.model_id}: 既定の effort ${value.default_effort} が選べません`,
    );
    // 常時行うモデルに「無効化できる」と書かない。
    if (value.mandatory) {
      assert.ok(!value.supported_efforts.includes('none'), `${entry.model_id}: 常時なのに none があります`);
    }
  }
  assert.deepEqual(
    formatReasoning({ mandatory: false, default_effort: 'high', supported_efforts: ['high', 'none'] }),
    { mode: '任意（none で無効化）', defaultEffort: 'high', efforts: 'high / none' },
  );
  assert.equal(
    formatReasoning({ mandatory: true, default_effort: 'medium', supported_efforts: ['high', 'medium'] }).mode,
    '常時',
  );
});

test('表の並びは提供元→名前で、価格順とも点数順とも違う', () => {
  const sorted = sortModelsByVendorName(models);
  assert.equal(sorted.length, models.length);
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const current = sorted[i];
    assert.ok(prev !== undefined && current !== undefined);
    const order =
      prev.vendor.localeCompare(current.vendor, 'en') ||
      prev.name.localeCompare(current.name, 'en');
    assert.ok(order <= 0, `${prev.name} と ${current.name} の順が提供元→名前になっていません`);
  }

  const priceOrder = [...models]
    .sort((a, b) => a.pricing.input - b.pricing.input)
    .map((model) => model.source_id);
  assert.notDeepEqual(
    sorted.map((model) => model.source_id),
    priceOrder,
    '表の並びが価格順と一致しています。価格順は ModelTable 側で扱う',
  );
});

test('能力と価格を混ぜない約束がデータに書かれている', () => {
  assert.equal(snapshot.policy.ordering, 'vendor-name');
  assert.match(snapshot.policy.price_separation, /価格/);
  assert.match(snapshot.policy.publish_rule, /確認/);
  assert.equal(snapshot.policy.freshness.review_after_days, 90);
  assert.match(snapshot.policy.freshness.stale_rule, /最新の値として扱わない/);

  // 価格の欄をこのファイルへ持ち込まない。
  const raw = readText('data/capability-snapshots.json');
  assert.doesNotMatch(raw, /"(price|pricing|input_price|output_price)"/);
});

test('表示側は未確認を隠さず、価格を読まない', () => {
  const component = readText('src/components/AxisComparison.astro');
  assert.match(component, /未確認/);
  assert.match(component, /確認済み/);
  assert.match(component, /sortModelsByVendorName/);
  assert.match(component, /source_id/);
  // 価格の列を持たない。model-comparison.json からは名前とIDだけを使う。
  assert.doesNotMatch(component, /pricing|price/i);

  const article = readText('src/content/chapters/18/04-conditional-comparison.mdx');
  assert.match(article, /<AxisComparison\b/);
  assert.match(article, /18\/03-price-context/, '価格表のページへ戻る導線がありません');
  assert.match(readText('src/content/chapters/18/03-price-context.mdx'), /18\/04-conditional-comparison/);
});

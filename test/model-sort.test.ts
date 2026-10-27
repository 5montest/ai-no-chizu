import assert from 'node:assert/strict';
import test from 'node:test';
import { compareModels, sortModels } from '../src/lib/model-sort.ts';
import type { SortableModel } from '../src/lib/model-sort.ts';

/**
 * モデル比較表の並び順のテスト。
 *
 * 「価格」ボタンが初期状態で選ばれているのに、表示が入力単価の安い順に
 * なっていない、という食い違いを防ぐための確認。
 */

function model(id: string, name: string, price: number, context = 1_000_000): SortableModel {
  return { id, name, context, price };
}

const SAMPLE = [
  model('b-model', 'ベータ', 2),
  model('a-model', 'アルファ', 0.1),
  model('c-model', 'ガンマ', 4),
  model('d-model', 'デルタ', 0.1),
];

test('価格は入力単価の安い順に並ぶ', () => {
  const sorted = sortModels('price', SAMPLE);
  const prices = sorted.map((m) => m.price);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
  assert.equal(sorted[0].price, 0.1);
  assert.equal(sorted.at(-1)?.price, 4);
});

test('コンテキストは大きい順に並ぶ', () => {
  const rows = [
    model('small', 'スモール', 1, 32_000),
    model('large', 'ラージ', 1, 1_000_000),
    model('mid', 'ミドル', 1, 128_000),
  ];
  assert.deepEqual(
    sortModels('context', rows).map((m) => m.id),
    ['large', 'mid', 'small'],
  );
});

test('名前は五十音順に並ぶ', () => {
  const rows = [model('c', 'うさぎ', 1), model('a', 'あひる', 1), model('b', 'いぬ', 1)];
  assert.deepEqual(
    sortModels('name', rows).map((m) => m.id),
    ['a', 'b', 'c'],
  );
});

test('単価が同じなら名前、名前も同じなら id で順番が決まる', () => {
  const rows = [
    model('z', '同じ名前', 1),
    model('a', '同じ名前', 1),
    model('m', 'あと', 1),
  ];
  const first = sortModels('price', rows).map((m) => m.id);
  assert.deepEqual(first, ['m', 'a', 'z']);

  // 入力の順番を変えても結果が変わらない＝同値でも並びが揺れない。
  const second = sortModels('price', [...rows].reverse()).map((m) => m.id);
  assert.deepEqual(second, first);
});

test('sortModels は元の配列を並べ替えない', () => {
  const rows = [model('b', 'ベータ', 2), model('a', 'アルファ', 1)];
  const before = rows.map((m) => m.id);
  sortModels('price', rows);
  assert.deepEqual(
    rows.map((m) => m.id),
    before,
  );
});

test('compareModels は同じ値どうしで 0 を返さない（id で決着する）', () => {
  const a = model('a', '同じ', 1);
  const b = model('b', '同じ', 1);
  assert.notEqual(compareModels('price', a, b), 0);
  assert.equal(compareModels('price', a, b), -compareModels('price', b, a));
});

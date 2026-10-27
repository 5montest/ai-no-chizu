import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { PRICE_AXIS, linearPercent, logPercent } from '../src/lib/chart-scale.ts';
import { nextTokenExample } from '../src/data/next-token-example.ts';

/**
 * グラフの数値と位置のテスト。
 *
 * 図はビルド時に HTML へ焼き込むので、値のずれは画面を見ないと気づけない。
 * ここで「記事の表と同じ値か」「軸の範囲からはみ出していないか」を先に見る。
 */

const ROOT = path.resolve(import.meta.dirname, '..');

const readText = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const models = (
  JSON.parse(readText('data/model-comparison.json')) as {
    models: { id: string; name: string; pricing: { input: number; output: number } }[];
  }
).models;

test('確率の例は合計が1になる', () => {
  const total = nextTokenExample.candidates.reduce((sum, item) => sum + item.probability, 0);
  assert.ok(Math.abs(total - 1) < 0.001, `合計が ${total} になっています`);
});

test('確率の例はすべて目盛りの範囲に収まる', () => {
  for (const item of nextTokenExample.candidates) {
    assert.ok(item.probability >= nextTokenExample.axis.min, `${item.label} が目盛りの下端を下回っています`);
    assert.ok(item.probability <= nextTokenExample.axis.max, `${item.label} が目盛りの上端を超えています`);
  }
});

test('記事の表とグラフのデータが一致する', () => {
  const mdx = readText('src/content/chapters/04/02-next-token.mdx');
  for (const item of nextTokenExample.candidates) {
    const logit = item.logit === null ? '—' : String(item.logit);
    const row = `| ${item.label} | ${logit} | ${item.probability.toFixed(2)} |`;
    assert.ok(mdx.includes(row), `記事の表に ${row} がありません`);
  }
});

test('グラフのコンポーネントが記事から使われている', () => {
  assert.match(readText('src/content/chapters/04/02-next-token.mdx'), /<ProbabilityChart\b/);
  assert.match(readText('src/content/chapters/18/03-price-context.mdx'), /<PriceCompareChart\b/);
});

test('単価は正の値で、出力が入力以上になっている', () => {
  assert.ok(models.length > 0, 'モデルが1件もありません');
  for (const model of models) {
    assert.ok(model.pricing.input > 0, `${model.id} の入力単価が0以下です`);
    assert.ok(model.pricing.output > 0, `${model.id} の出力単価が0以下です`);
    assert.ok(
      model.pricing.output >= model.pricing.input,
      `${model.id} は出力単価が入力単価より安く、ダンベルの左右が逆になります`,
    );
  }
});

test('単価の軸の範囲がすべてのモデルを含む', () => {
  const inputs = models.map((model) => model.pricing.input);
  const outputs = models.map((model) => model.pricing.output);
  const min = Math.min(...inputs, ...outputs);
  const max = Math.max(...inputs, ...outputs);
  assert.ok(min >= PRICE_AXIS.min, `最小値 ${min} が軸の下端 ${PRICE_AXIS.min} を下回っています`);
  assert.ok(max <= PRICE_AXIS.max, `最大値 ${max} が軸の上端 ${PRICE_AXIS.max} を超えています`);
});

test('対数軸の位置は値の順序を保ち、0〜100%に収まる', () => {
  const values = [0.08, 0.1, 0.5, 1, 4, 10, 50, 60];
  const percents = values.map((value) => logPercent(value, PRICE_AXIS.min, PRICE_AXIS.max));

  for (let i = 0; i < percents.length; i += 1) {
    const percent = percents[i] as number;
    assert.ok(percent >= 0 && percent <= 100, `${values[i]} の位置が ${percent}% になっています`);
    if (i > 0) {
      assert.ok(percent > (percents[i - 1] as number), `${values[i - 1]} と ${values[i]} の順序が逆です`);
    }
  }

  // 端の値はちょうど両端に来る。
  assert.equal(percents[0], 0);
  assert.equal(percents[percents.length - 1], 100);
});

test('対数軸では同じ倍率が同じ幅になる', () => {
  const width = (a: number, b: number) =>
    logPercent(b, PRICE_AXIS.min, PRICE_AXIS.max) - logPercent(a, PRICE_AXIS.min, PRICE_AXIS.max);
  assert.ok(Math.abs(width(1, 10) - width(5, 50)) < 1e-9);
  // 10倍と100倍は同じ幅にはならない（対数であることの確認）。
  assert.ok(Math.abs(width(1, 10) - width(1, 100)) > 1);
});

test('対数軸は0以下の値を受け付けない', () => {
  assert.throws(() => logPercent(0, PRICE_AXIS.min, PRICE_AXIS.max), /0以下/);
  assert.throws(() => logPercent(-1, PRICE_AXIS.min, PRICE_AXIS.max), /0以下/);
});

test('等間隔の軸は範囲外を端に丸める', () => {
  assert.equal(linearPercent(-0.5, 0, 1), 0);
  assert.equal(linearPercent(1.5, 0, 1), 100);
  assert.equal(linearPercent(0.35, 0, 0.7), 50);
  assert.throws(() => linearPercent(1, 5, 5), /範囲/);
});

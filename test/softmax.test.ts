import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { formatProbability, formatTemperature, softmax } from '../src/lib/softmax.ts';
import { nextTokenExample, softmaxLogits } from '../src/data/next-token-example.ts';

/**
 * 温度の実験の計算のテスト。
 *
 * 図はブラウザで確率を計算し直すので、ずれは画面を動かさないと気づけない。
 * 「温度1で記事の表と同じ値になるか」「どの温度でも合計が1か」「温度を下げると
 * 先頭の候補が強くなるか」を先に見る。
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const readText = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const LOGITS = softmaxLogits();

test('Softmax 用のロジットはすべての候補に用意されている', () => {
  assert.equal(LOGITS.length, nextTokenExample.candidates.length);
  for (const value of LOGITS) {
    assert.ok(Number.isFinite(value), `ロジット ${value} が数値ではありません`);
  }
});

test('温度1では記事の表と同じ確率になる', () => {
  const probabilities = softmax(LOGITS, 1);
  nextTokenExample.candidates.forEach((candidate, index) => {
    const actual = probabilities[index] as number;
    assert.equal(
      formatProbability(actual),
      candidate.probability.toFixed(2),
      `${candidate.label} が表の ${candidate.probability} と一致しません（計算値 ${actual}）`,
    );
  });
});

test('どの温度でも確率の合計は1になる', () => {
  for (let temperature = 0.5; temperature <= 2.0001; temperature += 0.1) {
    const probabilities = softmax(LOGITS, Number(temperature.toFixed(1)));
    const total = probabilities.reduce((sum, value) => sum + value, 0);
    assert.ok(Math.abs(total - 1) < 1e-9, `温度 ${temperature} の合計が ${total} になっています`);
    for (const value of probabilities) {
      assert.ok(value >= 0 && value <= 1, `温度 ${temperature} に範囲外の確率 ${value} があります`);
    }
  }
});

test('温度を下げると先頭の候補が強くなり、上げると弱くなる', () => {
  const low = softmax(LOGITS, 0.5)[0] as number;
  const mid = softmax(LOGITS, 1)[0] as number;
  const high = softmax(LOGITS, 2)[0] as number;
  assert.ok(low > mid, `温度0.5の ${low} が温度1の ${mid} 以下です`);
  assert.ok(mid > high, `温度1の ${mid} が温度2の ${high} 以下です`);
});

test('温度を変えても候補の順位は変わらない', () => {
  const order = (values: number[]) =>
    values
      .map((value, index) => ({ value, index }))
      .sort((a, b) => b.value - a.value)
      .map((item) => item.index);

  const expected = order(LOGITS);
  for (let temperature = 0.5; temperature <= 2.0001; temperature += 0.1) {
    const actual = order(softmax(LOGITS, Number(temperature.toFixed(1))));
    assert.deepEqual(actual, expected, `温度 ${temperature} で順位が変わりました`);
  }
});

test('温度0以下と空のロジットは計算しない', () => {
  assert.throws(() => softmax(LOGITS, 0), /温度/);
  assert.throws(() => softmax(LOGITS, -1), /温度/);
  assert.throws(() => softmax([], 1), /空/);
});

test('表示の桁数は図の約束どおり', () => {
  assert.equal(formatProbability(0.62065), '0.62');
  assert.equal(formatProbability(1), '1.00');
  assert.equal(formatTemperature(1), '1.0');
  assert.equal(formatTemperature(0.55), '0.6');
});

test('温度の図は記事から使われ、操作部は既定で隠れている', () => {
  assert.match(readText('src/content/chapters/08/02-sampling.mdx'), /<TemperatureExperiment\b/);

  // JavaScript が動かないときは、温度1の棒グラフだけが残る。
  const component = readText('src/components/TemperatureExperiment.astro');
  assert.match(component, /data-temperature-controls hidden/);
  assert.match(component, /softmaxLogits/);
});

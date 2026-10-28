import { test } from 'node:test';
import assert from 'node:assert/strict';

import { estimateCost, estimateTokens } from '../lib/cost.mjs';

function config({ input = null, output = null } = {}) {
  return {
    cost: {
      chars_per_token: 1.5,
      unit_price_input_per_1m: input,
      unit_price_output_per_1m: output,
      price_source: input === null ? null : 'test',
      price_checked_at: input === null ? null : '2026-10-28',
    },
  };
}

test('空の文字列はゼロトークン', () => {
  assert.equal(estimateTokens('', 1.5), 0);
  assert.equal(estimateTokens(undefined, 1.5), 0);
});

test('文字数を1文字あたりの文字数で割り、切り上げる', () => {
  assert.equal(estimateTokens('あいうえお', 1.5), 4);
  assert.equal(estimateTokens('あいう', 1.5), 2);
});

test('単価が空なら費用は null で、0円とは言わない', () => {
  const result = estimateCost({ inputText: '質問', outputText: '答え', config: config() });
  assert.equal(result.cost, null);
  assert.equal(result.priced, false);
});

test('片方だけ単価が入っていても計算しない', () => {
  const result = estimateCost({ inputText: '質問', outputText: '答え', config: config({ input: 100 }) });
  assert.equal(result.cost, null);
  assert.equal(result.priced, false);
});

test('両方の単価が入っていれば、トークン数から費用を出す', () => {
  // 入力 3文字 / 1.5 = 2トークン、出力 3文字 / 1.5 = 2トークン
  const result = estimateCost({
    inputText: 'あいう',
    outputText: 'えおか',
    config: config({ input: 1_000_000, output: 2_000_000 }),
  });
  assert.equal(result.inputTokens, 2);
  assert.equal(result.outputTokens, 2);
  assert.equal(result.priced, true);
  assert.equal(result.cost, 6);
});

test('費用には単価の出典と確認日が付いてくる', () => {
  const result = estimateCost({ inputText: 'あ', outputText: 'い', config: config({ input: 1, output: 1 }) });
  assert.equal(result.priceSource, 'test');
  assert.equal(result.priceCheckedAt, '2026-10-28');
});

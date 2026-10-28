import { test } from 'node:test';
import assert from 'node:assert/strict';

import { decide, sensitiveHits } from '../lib/routing.mjs';

const CONFIG = { retrieval: { min_coverage: 0.5, min_margin: 0.15 } };

function ranked({ score = 10, coverage = 0.9, margin = 0.5 } = {}) {
  return { top: { id: 'x', score }, coverage, margin };
}

test('機微な語が見つかる', () => {
  assert.deepEqual(sensitiveHits('先月の給与明細を見たい'), ['給与']);
  assert.deepEqual(sensitiveHits('会議室を予約したい'), []);
});

test('機微な語があれば、当たりが良くても人に回す', () => {
  const result = decide('契約の更新はいつですか', ranked({ coverage: 1, margin: 1 }), CONFIG);
  assert.equal(result.route, 'escalate');
  assert.match(result.reason, /契約/);
});

test('一つも当たらなければ答えない', () => {
  const result = decide('宇宙飛行士の採用', ranked({ score: 0, coverage: 0 }), CONFIG);
  assert.equal(result.route, 'refuse');
});

test('候補が無いときも答えない', () => {
  const result = decide('なにか', { top: undefined, coverage: 0, margin: 0 }, CONFIG);
  assert.equal(result.route, 'refuse');
});

test('当たりが下限を下回れば答えない', () => {
  const result = decide('経費の締め切り', ranked({ coverage: 0.49 }), CONFIG);
  assert.equal(result.route, 'refuse');
  assert.match(result.reason, /49%/);
});

test('当たりが下限ちょうどなら、次の判定に進む', () => {
  const result = decide('空調', ranked({ coverage: 0.5, margin: 1 }), CONFIG);
  assert.equal(result.route, 'answer');
});

test('一位と二位の差が下限を下回れば人に回す', () => {
  const result = decide('会議室の鍵', ranked({ coverage: 0.9, margin: 0.14 }), CONFIG);
  assert.equal(result.route, 'escalate');
  assert.match(result.reason, /14%/);
});

test('一位と二位の差が下限ちょうどなら答える', () => {
  const result = decide('会議室', ranked({ coverage: 0.9, margin: 0.15 }), CONFIG);
  assert.equal(result.route, 'answer');
});

test('条件を満たせば答える', () => {
  const result = decide('会議室を予約したい', ranked({ coverage: 0.9, margin: 0.4 }), CONFIG);
  assert.equal(result.route, 'answer');
  assert.match(result.reason, /当たり 90%/);
});

test('下限は設定ファイルから読む', () => {
  const strict = { retrieval: { min_coverage: 0.95, min_margin: 0.5 } };
  const result = decide('会議室', ranked({ coverage: 0.9, margin: 0.4 }), strict);
  assert.equal(result.route, 'refuse');
});

test('返り値には必ず理由が入る', () => {
  for (const coverage of [0, 0.4, 0.9]) {
    for (const margin of [0, 0.1, 0.9]) {
      const result = decide('会議室', ranked({ coverage, margin }), CONFIG);
      assert.ok(typeof result.reason === 'string' && result.reason.length > 0);
    }
  }
});

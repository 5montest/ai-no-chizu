import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildIndex, rank } from '../lib/retrieval.mjs';

const ENTRIES = [
  {
    id: 'room',
    title: '会議室の予約',
    when: '会議室を使いたいとき',
    body: '会議室は予約システムから予約してください。',
    source: '総務規程 第2条',
  },
  {
    id: 'printer',
    title: 'プリンタの用紙交換',
    when: '印刷で用紙が切れたとき',
    body: 'プリンタの用紙は、各フロアの棚にあります。',
    source: '総務規程 第11条',
  },
];

test('索引は項目数と語の重みを持つ', () => {
  const index = buildIndex(ENTRIES);
  assert.equal(index.docs.length, ENTRIES.length);
  assert.ok(index.idf.size > 0);
});

test('当たる質問では、その項目が一位になる', () => {
  const index = buildIndex(ENTRIES);
  const ranked = rank(index, '会議室を予約したい');
  assert.equal(ranked.top.id, 'room');
  assert.ok(ranked.top.score > 0);
});

test('どこにも当たらない質問は、点数ゼロで返る', () => {
  const index = buildIndex(ENTRIES);
  const ranked = rank(index, '宇宙飛行士の採用');
  assert.equal(ranked.top.score, 0);
  assert.equal(ranked.coverage, 0);
  assert.equal(ranked.margin, 1);
});

test('当たりの割合と、一位と二位の差は0から1に収まる', () => {
  const index = buildIndex(ENTRIES);
  const ranked = rank(index, 'プリンタの用紙');
  assert.ok(ranked.coverage >= 0 && ranked.coverage <= 1);
  assert.ok(ranked.margin >= 0 && ranked.margin <= 1);
});

test('同じ質問を二度投げても順位は変わらない', () => {
  const index = buildIndex(ENTRIES);
  const first = rank(index, 'プリンタの用紙');
  const second = rank(index, 'プリンタの用紙');
  assert.deepEqual(first.ranked, second.ranked);
  assert.equal(first.margin, second.margin);
});

test('候補は点数の高い順に並ぶ', () => {
  const index = buildIndex(ENTRIES);
  const { ranked } = rank(index, '会議室とプリンタ');
  for (let i = 1; i < ranked.length; i += 1) {
    assert.ok(ranked[i - 1].score >= ranked[i].score);
  }
});

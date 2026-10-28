import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createEngine } from '../lib/engine.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const faq = JSON.parse(await readFile(join(ROOT, 'data', 'faq.json'), 'utf8'));
const config = JSON.parse(await readFile(join(ROOT, 'config.json'), 'utf8'));
const evalSet = JSON.parse(await readFile(join(ROOT, 'data', 'eval-questions.json'), 'utf8'));

const engine = createEngine({ entries: faq.entries, config });

test('FAQ の項目は、必要な項目をすべて持つ', () => {
  assert.ok(faq.entries.length >= 10);
  for (const entry of faq.entries) {
    for (const key of ['id', 'title', 'body', 'when', 'source']) {
      assert.ok(typeof entry[key] === 'string' && entry[key].length > 0, `${entry.id} の ${key}`);
    }
  }
});

test('FAQ の項目 id は重複しない', () => {
  const ids = faq.entries.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('評価用の質問が期待する項目を指している', () => {
  const ids = new Set(faq.entries.map((entry) => entry.id));
  for (const item of evalSet.questions) {
    assert.ok(ids.has(item.top), `${item.query} の top が FAQ に無い`);
  }
});

test('評価用の質問はすべて期待どおりの判定になる', () => {
  for (const item of evalSet.questions) {
    const result = engine.ask(item.query);
    assert.equal(result.route, item.route, item.query);
    assert.equal(result.candidates[0].id, item.top, item.query);
  }
});

test('答えるときは、本文と出典を返す', () => {
  const result = engine.ask('会議室を予約したい');
  assert.equal(result.route, 'answer');
  assert.equal(result.entry.id, 'room-booking');
  assert.match(result.text, /出典：/);
  assert.ok(result.text.length > 20);
});

test('答えないときは、人が見る連絡先を返す', () => {
  for (const query of ['経費の締め切りは？', '給与明細が見たい']) {
    const result = engine.ask(query);
    assert.notEqual(result.route, 'answer', query);
    assert.equal(result.entry, null, query);
    assert.match(result.text, /設備担当/, query);
    assert.equal(result.candidates.length, 3, query);
  }
});

test('同じ質問を二度投げても、判定も文面も変わらない', () => {
  const first = engine.ask('コピーの紙が詰まった');
  const second = engine.ask('コピーの紙が詰まった');
  assert.deepEqual(first, second);
});

test('費用は、単価が未入力のあいだは null のまま', () => {
  const result = engine.ask('会議室を予約したい');
  assert.equal(result.cost.priced, false);
  assert.equal(result.cost.cost, null);
  assert.ok(result.cost.inputTokens > 0);
});

test('空の質問でも落ちない', () => {
  const result = engine.ask('');
  assert.equal(result.route, 'refuse');
  assert.equal(result.cost.inputTokens, 0);
});

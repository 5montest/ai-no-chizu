import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalize, terms } from '../lib/text.mjs';

test('正規化は全角を半角にし、英字を小文字にする', () => {
  assert.equal(normalize('ＡＢＣ　１２３'), 'abc 123');
});

test('前後の空白や null でも落ちない', () => {
  assert.equal(normalize(undefined), '');
  assert.equal(normalize(null), '');
});

test('日本語は2文字の組に分かれる', () => {
  const result = terms('会議室を予約');
  assert.ok(result.includes('会議'));
  assert.ok(result.includes('議室'));
  assert.ok(result.includes('予約'));
});

test('句読点は語に含めない', () => {
  const result = terms('鍵、なくした。');
  assert.ok(result.includes('鍵な'));
  assert.ok(!result.some((term) => term.includes('、')));
  assert.ok(!result.some((term) => term.includes('。')));
});

test('英数字は2文字以上のまとまりを語として扱う', () => {
  const result = terms('Wi-Fi の password');
  assert.ok(result.includes('password'));
});

test('1文字だけの質問は、その1文字を語として扱う', () => {
  assert.deepEqual(terms('鍵'), ['鍵']);
});

test('同じ入力からは同じ語の集合が返る', () => {
  assert.deepEqual(terms('会議室を予約したい'), terms('会議室を予約したい'));
});

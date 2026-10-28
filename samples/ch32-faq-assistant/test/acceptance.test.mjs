import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createEngine } from '../lib/engine.mjs';
import { buildIndex, rank } from '../lib/retrieval.mjs';

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

// 第32章の演習に書いた「機微な語の判定を点差の判定の後ろへ移す」変更を、
// テストの中だけで再現し、本文に記した判定と理由を固定する。
// 公開している lib/routing.mjs は変えない。演習で写しを書き換えた場合も、
// 二つの順番を作り直して比べるので、このテスト自体は通ったままになる。
// そのため、演習の変更で落ちるのは「評価用の質問はすべて期待どおりの判定になる」の一件だけ。
test('本文に書いた順番の入れ替えは、記録した判定の変化を再現する', async () => {
  const source = await readFile(join(ROOT, 'lib', 'routing.mjs'), 'utf8');

  const hitsLine = '  const hits = sensitiveHits(query);';
  const block = [
    '  if (hits.length > 0) {',
    '    return {',
    "      route: 'escalate',",
    '      reason: `機微な語を含む（${hits.join(\'、\')}）ため、自動回答しない`,',
    '      hits,',
    '    };',
    '  }',
    '',
    '',
  ].join('\n');
  const margin = [
    '  if (ranked.margin < minMargin) {',
    '    return {',
    "      route: 'escalate',",
    '      reason: `一位と二位の差が ${Math.round(ranked.margin * 100)}%（下限 ${Math.round(minMargin * 100)}%）`,',
    '      hits,',
    '    };',
    '  }',
    '',
  ].join('\n');

  // 差分の前提が崩れていないこと（本文の手順どおりに置き換えられること）を先に確かめる。
  assert.ok(source.includes(hitsLine), 'routing.mjs に、hits を求める行がそのままある');
  assert.ok(source.includes(block), 'routing.mjs に、移す対象のブロックがそのままある');
  assert.ok(source.includes(margin), 'routing.mjs に、移す先の点差判定がそのままある');

  const withoutBlock = source.replace(block, '');
  assert.notEqual(withoutBlock, source, '移す対象のブロックを取り除ける');

  // 変更前: hits を求める行のすぐ後ろに if のブロックがある。
  const atTop = withoutBlock.replace(hitsLine, `${hitsLine}\n${block}`);
  // 変更後: 同じブロックを、点差判定の後ろへ移す。hits を求める行は先頭のまま。
  const atEnd = withoutBlock.replace(margin, `${margin}${block}`);

  const index = buildIndex(faq.entries);
  const salary = '給与明細が見たい';
  const refund = '返金してほしい';

  async function load(routingSource) {
    const dir = await mkdtemp(join(tmpdir(), 'ch32-order-'));
    try {
      await writeFile(join(dir, 'routing.mjs'), routingSource);
      await writeFile(join(dir, 'text.mjs'), await readFile(join(ROOT, 'lib', 'text.mjs'), 'utf8'));
      return await import(pathToFileURL(join(dir, 'routing.mjs')).href);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  const before = await load(atTop);
  const after = await load(atEnd);

  assert.equal(before.decide(salary, rank(index, salary), config).route, 'escalate');
  assert.match(before.decide(salary, rank(index, salary), config).reason, /機微な語を含む（給与）/);
  assert.equal(after.decide(salary, rank(index, salary), config).route, 'refuse');
  assert.equal(
    after.decide(salary, rank(index, salary), config).reason,
    '質問の語のうち当たったのが 14%（下限 50%）',
  );

  assert.equal(before.decide(refund, rank(index, refund), config).route, 'escalate');
  assert.match(before.decide(refund, rank(index, refund), config).reason, /機微な語を含む（返金）/);
  assert.equal(after.decide(refund, rank(index, refund), config).route, 'escalate');
  assert.equal(
    after.decide(refund, rank(index, refund), config).reason,
    '一位と二位の差が 0%（下限 15%）',
  );

  const changed = evalSet.questions.filter(
    (item) => before.decide(item.query, rank(index, item.query), config).route !== after.decide(item.query, rank(index, item.query), config).route,
  );
  assert.deepEqual(changed.map((item) => item.query), [salary]);
});

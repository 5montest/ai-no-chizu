import assert from 'node:assert/strict';
import test from 'node:test';
import remarkBulletLabels from '../src/plugins/remark-bullet-labels.mjs';

/**
 * 箇条書きの「用語：説明」の用語に注意を引く（<b>）プラグインのテスト。
 *
 * 出力は <strong> ではなく <b>。strong は「強い重要性」を表すため、
 * 項目の見出し語に付けると文書の意味が変わってしまう。<b> は重要性を
 * 伴わずに注意を引く語（要旨のキーワードなど）に使う。
 *
 * 対象は名詞のラベルだけ。文のラベル（句点で説明が続く形）や、既に
 * 強調・リンクで始まる項目は文章の意図を優先して触らない。
 */

/** テストで組み立てる mdast の最小形。必要な項目だけを持つ。 */
type MdNode = {
  type: string;
  name?: string;
  attributes?: unknown[];
  value?: string;
  children?: MdNode[];
  ordered?: boolean;
  spread?: boolean;
};

function root(...children: MdNode[]): MdNode {
  return { type: 'root', children };
}

function list(...items: MdNode[]): MdNode {
  return { type: 'list', ordered: false, spread: false, children: items };
}

function item(...children: MdNode[]): MdNode {
  return { type: 'listItem', spread: false, children };
}

function para(...children: MdNode[]): MdNode {
  return { type: 'paragraph', children };
}

function text(value: string): MdNode {
  return { type: 'text', value };
}

/** MDX の <b>。</b> 相当。既に強調で始まる項目の再現に使う。 */
function bold(...children: MdNode[]): MdNode {
  return { type: 'mdxJsxTextElement', name: 'b', attributes: [], children };
}

function code(value: string): MdNode {
  return { type: 'inlineCode', value };
}

function run(mdast: MdNode): MdNode {
  remarkBulletLabels()(mdast);
  return mdast;
}

/** listItem の先頭段落の中身を取り出す。 */
function firstItem(doc: MdNode): MdNode[] {
  const listNode = doc.children?.[0];
  const itemNode = listNode?.children?.[0];
  return itemNode?.children?.[0]?.children ?? [];
}

/** 出力された強調が <b> であることを確かめる。 */
function assertBold(node: MdNode | undefined, label: string) {
  assert.ok(node, `${label} のノードがない`);
  assert.equal(node.type, 'mdxJsxTextElement');
  assert.equal(node.name, 'b');
  assert.deepEqual(node.attributes, []);
  assert.deepEqual(node.children?.[0], { type: 'text', value: label });
}

test('「用語：説明」の用語だけを太字にし、コロンは本文に残す', () => {
  const doc = run(root(list(item(para(text('Greedy：毎回、最も確率の高いトークンを選ぶ。'))))));

  const children = firstItem(doc);
  assert.equal(children.length, 2);
  assertBold(children[0], 'Greedy');
  assert.deepEqual(children[1], { type: 'text', value: '：毎回、最も確率の高いトークンを選ぶ。' });
});

test('<strong> は出力しない（重要性を表す要素は使わない）', () => {
  const doc = run(root(list(item(para(text('トークン：文字を分割した単位。'))))));

  const types = (function collect(node: MdNode): string[] {
    const self = [node.type];
    for (const child of node.children ?? []) self.push(...collect(child));
    return self;
  })(doc);

  assert.equal(types.includes('strong'), false);
  assert.equal(types.includes('html'), false);
});

test('コロンの直後がインラインコードでも用語だけを太字にする', () => {
  const doc = run(root(list(item(para(text('1回あたり：'), code('$0.009'))))));

  const children = firstItem(doc);
  assertBold(children[0], '1回あたり');
  assert.deepEqual(children[1], { type: 'text', value: '：' });
  assert.equal(children[2].type, 'inlineCode');
});

test('句点で説明が続く文のラベルは触らない', () => {
  const doc = run(root(list(item(para(text('名前は動詞で具体的に。`search_docs` は分かりやすい。'))))));

  const children = firstItem(doc);
  assert.equal(children.length, 1);
  assert.equal(children[0].type, 'text');
});

test('ラベルに読点を含む文は触らない', () => {
  const doc = run(root(list(item(para(text('入力の長さ、出力の長さ：どちらも課金される。'))))));

  const children = firstItem(doc);
  assert.equal(children.length, 1);
  assert.equal(children[0].type, 'text');
});

test('既に強調で始まる項目はそのまま残す', () => {
  const doc = run(root(list(item(para(bold(text('承認')), text('：人間が確認する。'))))));

  const children = firstItem(doc);
  assert.equal(children.length, 2);
  assert.deepEqual(children[0], bold(text('承認')));
  assert.deepEqual(children[1], { type: 'text', value: '：人間が確認する。' });
});

test('入れ子の箇条書きにも適用する', () => {
  const doc = run(
    root(list(item(para(text('外側：説明')), list(item(para(text('内側：説明'))))))),
  );

  const outer = firstItem(doc);
  assertBold(outer[0], '外側');

  const nested = doc.children?.[0]?.children?.[0]?.children?.[1];
  const inner = nested?.children?.[0]?.children?.[0]?.children ?? [];
  assertBold(inner[0], '内側');
});

test('箇条書き以外の段落は触らない', () => {
  const doc = run(root(para(text('入力：会話履歴と資料で 2,000トークン'))));

  const children = doc.children?.[0]?.children ?? [];
  assert.equal(children.length, 1);
  assert.equal(children[0].type, 'text');
});

test('長すぎるラベルは文とみなして触らない', () => {
  const longLabel = 'あ'.repeat(41);
  const doc = run(root(list(item(para(text(`${longLabel}：説明`))))));

  const children = firstItem(doc);
  assert.equal(children.length, 1);
  assert.equal(children[0].type, 'text');
});

test('同じツリーを2回通しても太字が二重にならない', () => {
  const doc = root(list(item(para(text('Greedy：説明')))));
  remarkBulletLabels()(doc);
  remarkBulletLabels()(doc);

  const children = firstItem(doc);
  assert.equal(children.length, 2);
  assertBold(children[0], 'Greedy');
  assert.equal(children[1].type, 'text');
});

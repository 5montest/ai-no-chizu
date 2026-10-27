/**
 * 箇条書きの「用語：説明」の用語部分に注意を引く（太字にする）。
 *
 * 本文の表記は「用語：説明」のまま1か所で保ち、強調は表示側で付ける。
 * MDX に ** を書き足す方式だと、書き忘れが記事ごとにばらついて
 * 「太字の箇条書き」と「そうでない箇条書き」が混在する。ここで一括して
 * 判定することで、将来書く箇条書きも同じ見た目になる。
 *
 * 出力する要素は <b> で、<strong> ではない。HTML Standard の定義は次のとおり。
 *   - strong: 強い重要性、重大さ、緊急性（"strong importance ... seriousness or urgency"）
 *   - b: 重要性を伴わずに注意を引く文字列。要旨のキーワード、レビュー中の
 *        製品名、操作可能な語など（"attention ... without conveying any extra
 *        importance ... such as key words in a document abstract"）
 * 項目の頭の見出し語は後者なので、b を使う。太字にするのは全角コロンより
 * 前だけ。コロン自体は本文の区切りなので強調に含めない。文のラベル
 * （「〜でよい」「〜を書く」など、句点で説明が続く形）は対象外とし、
 * 名詞のラベルだけを拾う。
 *
 * 記事は .mdx なので、mdast の html ノードは使えない（MDX は生 HTML を
 * 解釈せず、そのままでは変換できない）。JSX 要素として b を出力する。
 */

const COLON = '：';

/** ラベルとして扱う長さの上限。超えるものは文の頭とみなして触らない。 */
const MAX_LABEL_LENGTH = 40;

/** ラベルに混ざっていたら文と判断する記号。 */
const SENTENCE_MARKS = ['。', '、', '！', '？'];

function splitLabel(value) {
  const index = value.indexOf(COLON);
  if (index <= 0) return null;

  const label = value.slice(0, index);
  if (label.length > MAX_LABEL_LENGTH) return null;
  if (label.includes('\n')) return null;
  if (label.trim() !== label) return null;
  if (SENTENCE_MARKS.some((mark) => label.includes(mark))) return null;

  return { label, rest: value.slice(index) };
}

/** MDX の地の文に置く <b>。</b> 相当のノードを作る。 */
function attentionElement(children) {
  return {
    type: 'mdxJsxTextElement',
    name: 'b',
    attributes: [],
    children,
  };
}

function emphasizeLabel(item) {
  const paragraph = item.children?.[0];
  if (paragraph?.type !== 'paragraph') return;

  const first = paragraph.children?.[0];
  // 既に強調やリンクで始まる項目は、書き手の意図を優先して触らない。
  if (first?.type !== 'text') return;

  const split = splitLabel(first.value);
  if (!split) return;

  first.value = split.rest;
  paragraph.children.unshift(attentionElement([{ type: 'text', value: split.label }]));
}

function walk(node) {
  if (node.type === 'listItem') emphasizeLabel(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) walk(child);
  }
}

export default function remarkBulletLabels() {
  return (tree) => walk(tree);
}

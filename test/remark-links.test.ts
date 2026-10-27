import assert from 'node:assert/strict';
import test from 'node:test';
import remarkGuideLinks from '../src/plugins/remark-guide-links.mjs';

/**
 * [[...]] リンクと、サイト内絶対リンクの base 付与のテスト。
 *
 * サブパス配信と独自ドメイン配信を同じコードで扱うため、base の付け方が
 * 一か所でも抜けるとリンクが切れる。ビルド全体を回さずに確かめる。
 */

/** テストで組み立てる mdast の最小形。必要な項目だけを持つ。 */
type MdNode = {
  type: string;
  value?: string;
  url?: string;
  children?: MdNode[];
  data?: { hProperties?: { className?: string[] } };
};

function tree(...children: MdNode[]): MdNode {
  return { type: 'root', children };
}

function para(...children: MdNode[]): MdNode {
  return { type: 'paragraph', children };
}

function text(value: string): MdNode {
  return { type: 'text', value };
}

function run(mdast: MdNode, { base }: { base: string }): MdNode {
  remarkGuideLinks({ base })(mdast, { path: 'test.mdx' });
  return mdast;
}

function collectLinks(node: MdNode, out: MdNode[] = []): MdNode[] {
  if (Array.isArray(node.children)) node.children.forEach((child) => collectLinks(child, out));
  if ((node.type === 'link' || node.type === 'image') && typeof node.url === 'string') out.push(node);
  return out;
}

/** n 番目のリンクを取り出す。足りないときは「無かった」ことを assert で示す。 */
function at(links: MdNode[], index: number): MdNode {
  const link = links[index];
  assert.ok(link, `${index + 1}件目のリンクが見つかりません`);
  return link;
}

test('[[term]] は用語辞典へのリンクになる', () => {
  const mdast = run(tree(para(text('これは [[ai]] の話です。'))), { base: '/docs' });
  const links = collectLinks(mdast);
  assert.equal(links.length, 1);
  const link = at(links, 0);
  assert.equal(link.url, '/docs/glossary/ai/');
  assert.equal(link.children?.[0]?.value, 'AI（人工知能）');
  assert.deepEqual(link.data?.hProperties?.className, ['gloss-link']);
});

test('[[term|表示]] は表示名を優先し、リンク先は変えない', () => {
  const mdast = run(tree(para(text('[[ai|人工知能とは]]'))), { base: '' });
  const link = at(collectLinks(mdast), 0);
  assert.equal(link.url, '/glossary/ai/');
  assert.equal(link.children?.[0]?.value, '人工知能とは');
});

test('[[ch:04]] は章のページへ、[[ch:04/slug]] は記事へ飛ぶ', () => {
  const mdast = run(tree(para(text('[[ch:04]] と [[ch:04/01-pipeline]]'))), { base: '/docs' });
  const links = collectLinks(mdast);
  assert.equal(at(links, 0).url, '/docs/chapters/04/');
  const page = at(links, 1);
  assert.equal(page.url, '/docs/chapters/04/01-pipeline/');
  assert.deepEqual(page.data?.hProperties?.className, ['xref-link']);
});

test('存在しない用語・章・ページはビルドを止める', () => {
  assert.throws(
    () => run(tree(para(text('[[no-such-term]]'))), { base: '' }),
    /未登録の用語/,
  );
  assert.throws(() => run(tree(para(text('[[ch:99]]'))), { base: '' }), /未登録の章/);
  assert.throws(
    () => run(tree(para(text('[[ch:04/no-such-page]]'))), { base: '' }),
    /未登録のページ/,
  );
});

test('サイト内絶対リンクに base を一度だけ付ける', () => {
  const mdast = tree(
    para({
      type: 'link',
      url: '/chapters/',
      children: [text('章一覧')],
    }),
    para({
      type: 'link',
      url: '/docs/glossary/',
      children: [text('用語集')],
    }),
    para({
      type: 'link',
      url: 'https://example.com/',
      children: [text('外部')],
    }),
    para({
      type: 'link',
      url: '/docs',
      children: [text('base と同じで始まる別パス')],
    }),
  );
  run(mdast, { base: '/docs' });
  const urls = collectLinks(mdast).map((link) => link.url);
  assert.deepEqual(urls, [
    '/docs/chapters/',
    '/docs/glossary/',
    'https://example.com/',
    '/docs/docs',
  ]);
});

test('base が空（ルート配信）ならパスはそのまま', () => {
  const mdast = tree(
    para({ type: 'link', url: '/chapters/', children: [text('章一覧')] }),
  );
  run(mdast, { base: '' });
  assert.equal(at(collectLinks(mdast), 0).url, '/chapters/');
});

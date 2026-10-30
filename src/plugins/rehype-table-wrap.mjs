/**
 * 表を横スクロールできる器で包む。
 *
 * 日本語の表は列が増えると 390px 幅では1行あたり数文字まで潰れる。
 * 潰して読めなくするより、表だけを横に送れるようにして列幅を保つ。
 * 器に入れておくと、スクロールできることを示す案内も同時に出せる。
 */

function isElement(node, tagName) {
  return node && node.type === 'element' && node.tagName === tagName;
}

function visit(node, onTable) {
  if (!node || !Array.isArray(node.children)) return node;
  const next = [];
  for (const child of node.children) {
    if (isElement(child, 'table')) {
      next.push(onTable(child));
      continue;
    }
    visit(child, onTable);
    next.push(child);
  }
  node.children = next;
  return node;
}

export default function rehypeTableWrap() {
  return (tree) => {
    visit(tree, (table) => ({
      type: 'element',
      tagName: 'div',
      properties: { className: ['table-wrap'] },
      children: [
        {
          type: 'element',
          tagName: 'span',
          properties: { className: ['table-wrap__hint'], ariaHidden: 'true' },
          children: [{ type: 'text', value: '横にスクロールできます →' }],
        },
        table,
      ],
    }));
    return tree;
  };
}

export const SITE = {
  name: 'AIの地図',
  tagline: 'なんとなく使うから、仕組みを理解して使うへ',
  description:
    '社会人向けのAI技術ガイド。AI・機械学習・LLM・Transformer・エージェント・モデル選びを、図と短いページで体系的に学ぶ。',
  author: 'AIの地図 編集部',
  base: '/20261027-website-design-implementation/site',
  published: '2026-10-27',
  updated: '2026-10-27',
};

export function withBase(pathname = '/') {
  const clean = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (clean === '/') return `${SITE.base}/`;
  return `${SITE.base}${clean}`;
}

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import glossary from '../data/glossary.json';
import curriculum from '../data/curriculum.json';
import { withBase } from '../lib/site.mjs';

function cleanBody(body: string) {
  return body
    .replace(/^import\s.+$/gm, ' ')
    .replace(/^export\s.+$/gm, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#>*_`~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);
}

export const GET: APIRoute = async () => {
  const entries = await getCollection('chapters');
  const categoryLabel = Object.fromEntries(glossary.categories.map((c) => [c.id, c.label]));

  const pages = entries
    .sort(
      (a, b) =>
        Number(a.data.chapter) - Number(b.data.chapter) || a.data.order - b.data.order,
    )
    .map((entry) => {
      const [chapterId, slug] = entry.id.split('/');
      const chapter = curriculum.chapters.find((c) => c.id === chapterId);
      return {
        type: 'page',
        title: entry.data.title,
        description: entry.data.description,
        text: cleanBody(entry.body ?? ''),
        url: withBase(`/chapters/${chapterId}/${slug}/`),
        chapter: chapterId,
        chapterTitle: chapter?.shortTitle ?? '',
        tags: entry.data.tags,
        featured: entry.data.order === 1,
      };
    });

  pages.push(
    { type: 'page', title: 'はじめての方へ・学習ルート', description: '仕組みを学ぶ、生成AIを使う、製品を選ぶ、導入を判断する、エージェントを実装する入口。', text: '業務で使う 仕組み 原理 提案を読む 社内導入 判断 依頼 プロンプト 入門 学習ルート 比較 実装 CLI', url: withBase('/start/'), chapter: '', chapterTitle: '学習ルート', tags: ['入門', '業務活用'], featured: true },
    { type: 'page', title: '導入判断の確認シート', description: '用途・情報・品質・費用・権限・運用を確認。印刷やテンプレート保存もできます。', text: 'AI導入 チェックリスト 試験導入 PoC 学習 保存 削除 契約 効果 品質 評価 工数 コスト 停止 見直し', url: withBase('/checklist/'), chapter: '', chapterTitle: '導入判断', tags: ['業務活用', '導入判断'], featured: true },
  );

  const terms = glossary.terms.map((term) => ({
    type: 'term',
    title: term.term,
    description: term.short,
    text: `${term.reading} ${term.aliases.join(' ')} ${term.strict} ${term.myth} ${term.example}`,
    url: withBase(`/glossary/${term.slug}/`),
    categoryLabel: categoryLabel[term.category] ?? '',
    short: term.short,
    chapter: term.chapters[0] ?? '',
    tags: term.related,
    featured: ['ai', 'llm', 'token', 'transformer', 'agent', 'benchmark'].includes(term.slug),
  }));

  return new Response(JSON.stringify({ pages, terms }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};

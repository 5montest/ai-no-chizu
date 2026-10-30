import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import glossary from '../data/glossary.json';
import curriculum from '../data/curriculum.json';
import { entitySearchText } from '../lib/zukan.mjs';
import zukanJson from '../../data/zukan.json';
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
    { type: 'page', title: 'はじめての方へ・学習ルート', description: '仕組みを学び直す、生成AIを使う、提案を読む、製品を選ぶ、導入を判断する、エージェントを実装する入口。', text: '業務で使う 仕組み 原理 提案を読む 提案書 見積 稟議 社内導入 判断 依頼 プロンプト 入門 学習ルート 比較 実装 CLI', url: withBase('/start/'), chapter: '', chapterTitle: '学習ルート', tags: ['入門', '業務活用'], featured: true },
    { type: 'page', title: '導入判断の確認シート', description: '用途・情報・品質・費用・権限・運用を確認。印刷やテンプレート保存もできます。', text: 'AI導入 チェックリスト 試験導入 PoC 学習 保存 削除 契約 効果 品質 評価 工数 コスト 停止 見直し 提案書 見積書 稟議 SLA 免責 解約 データ所在地 再委託', url: withBase('/checklist/'), chapter: '', chapterTitle: '導入判断', tags: ['業務活用', '導入判断'], featured: true },
    { type: 'page', title: 'AI図鑑（製品・モデル・プラン）', description: 'モデル・ハーネス・アプリ・契約を、確認日と出典つきで探して比べる一覧。', text: 'AI図鑑 製品 モデル プラン 料金 比較 一覧 公式 未確認 取得日 ハーネス アプリ', url: withBase('/zukan/'), chapter: '', chapterTitle: 'AI図鑑', tags: ['製品比較', '料金'], featured: true },
    { type: 'page', title: 'AI図鑑の比較', description: '2件以上の製品を、同じ項目で並べて比べる。', text: '比較 並べる 料金 文脈長 用途 提供元 モデルID 条件', url: withBase('/zukan/compare/'), chapter: '', chapterTitle: 'AI図鑑', tags: ['製品比較', '料金'], featured: false },
    { type: 'page', title: '用語辞典', description: '「ひとことで」「厳密には」「よくある誤解」の3層で用語を説明。', text: '用語 辞典 意味 定義 誤解 読み方 索引', url: withBase('/glossary/'), chapter: '', chapterTitle: '用語辞典', tags: ['用語'], featured: false },
    { type: 'page', title: '実践編の入口', description: '製品の選び方から、CLI・ハーネス・専用モデルの組合せまで。', text: '実践 演習 CLI ハーネス 製品を選ぶ 導入 開発', url: withBase('/practice/'), chapter: '', chapterTitle: '実践編', tags: ['実践', '業務活用'], featured: false },
    { type: 'page', title: 'クイズ', description: '章ごとの理解チェック。答えを選ぶと解説が出ます。', text: 'クイズ 理解 確認 復習 問題', url: withBase('/quiz/'), chapter: '', chapterTitle: 'クイズ', tags: ['復習'], featured: false },
  );

  // AI図鑑の57件は、検索から直接たどれるようにする（章・用語と同じ索引に載せる）。
  const kindLabels = Object.fromEntries(zukanJson.kinds.map((kind) => [kind.id, kind.label]));
  const products = zukanJson.entities.map((entity) => ({
    type: 'product',
    title: entity.display_name,
    description: entity.summary ?? entity.notes ?? '',
    text: `${entitySearchText(entity)} ${kindLabels[entity.kind] ?? entity.kind}`,
    url: withBase(`/zukan/${entity.slug}/`),
    vendor: entity.vendor,
    kindLabel: kindLabels[entity.kind] ?? entity.kind,
    tags: entity.aliases ?? [],
    featured: false,
  }));

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

  return new Response(JSON.stringify({ pages, terms, products }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};

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

  const terms = glossary.terms.map((term) => ({
    type: 'term',
    title: term.term,
    description: term.short,
    text: `${term.reading} ${term.strict} ${term.myth}`,
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

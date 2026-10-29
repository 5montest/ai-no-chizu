import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import curriculum from '../data/curriculum.json';
import glossary from '../data/glossary.json';
import zukan from '../../data/zukan.json';
import { SITE, withBase } from '../lib/site.mjs';

/**
 * 公開ページのサイトマップ。ビルド時に site/sitemap.xml を書き出す。
 *
 * 依存パッケージを増やさず、公開しているルートだけを列挙する。404 と
 * search.json は検索の対象外なので含めない。URL は canonical と同じく
 * astro.config.mjs の site と base から絶対URLを作る。
 */

type Entry = { path: string; lastmod: string };

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const asDate = (value: unknown) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : SITE.updated;

export const GET: APIRoute = async ({ site, url }) => {
  const origin = site ?? new URL(url.origin);
  const entries = await getCollection('chapters');

  const staticPages = [
    '/',
    '/start/',
    '/chapters/',
    '/practice/',
    '/glossary/',
    '/zukan/',
    '/zukan/compare/',
    '/checklist/',
    '/quiz/',
    '/about/',
  ];

  const pages: Entry[] = staticPages.map((path) => ({ path, lastmod: SITE.updated }));

  const chapterLatest = new Map<string, string>();
  for (const entry of entries) {
    const [chapterId] = entry.id.split('/');
    const updated = asDate(entry.data.updated);
    const current = chapterLatest.get(chapterId);
    if (!current || current < updated) chapterLatest.set(chapterId, updated);
    pages.push({
      path: `/chapters/${chapterId}/${entry.id.split('/')[1]}/`,
      lastmod: updated,
    });
  }

  for (const chapter of curriculum.chapters) {
    if (chapter.status !== 'published') continue;
    pages.push({
      path: `/chapters/${chapter.id}/`,
      lastmod: chapterLatest.get(chapter.id) ?? SITE.updated,
    });
  }

  for (const term of glossary.terms) {
    pages.push({ path: `/glossary/${term.slug}/`, lastmod: asDate(term.updated) });
  }

  for (const entity of zukan.entities) {
    pages.push({ path: `/zukan/${entity.slug}/`, lastmod: asDate(entity.last_checked_at) });
  }

  const unique = new Map<string, string>();
  for (const entry of pages) {
    const existing = unique.get(entry.path);
    if (!existing || existing < entry.lastmod) unique.set(entry.path, entry.lastmod);
  }

  const urls = [...unique.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([path, lastmod]) =>
        `  <url>\n    <loc>${escapeXml(new URL(withBase(path), origin).href)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`,
    )
    .join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};

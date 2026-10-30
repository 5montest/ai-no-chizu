import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeBase } from '../lib/site.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

let cache = null;

function loadGuide() {
  if (cache) return cache;

  const curriculum = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'src/data/curriculum.json'), 'utf8'),
  );
  const glossary = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'src/data/glossary.json'), 'utf8'),
  );

  const chapters = new Map();
  for (const ch of curriculum.chapters) {
    chapters.set(ch.id, ch);
  }

  const terms = new Map();
  for (const term of glossary.terms) {
    terms.set(term.slug, term);
  }

  // ページ本文のタイトルを frontmatter から拾い、[[ch:04/slug]] の表示名に使う。
  const pages = new Map();
  const contentRoot = path.join(ROOT, 'src/content/chapters');
  if (fs.existsSync(contentRoot)) {
    const files = fs.readdirSync(contentRoot, { recursive: true });
    for (const file of files) {
      if (!String(file).endsWith('.mdx')) continue;
      const rel = String(file).split(path.sep).join('/');
      const id = rel.replace(/\.mdx$/, '');
      const source = fs.readFileSync(path.join(contentRoot, rel), 'utf8');
      // Windows で CRLF のままチェックアウトしても本文タイトルを拾えるようにする。
      const fm = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      const title = fm?.[1].match(/^title:\s*["']?(.+?)["']?\r?\s*$/m)?.[1];
      if (title) pages.set(id, title);
    }
  }

  cache = { chapters, terms, pages };
  return cache;
}

const WIKI_LINK = /\[\[([^\]\n]+)\]\]/g;

function parseInner(inner) {
  const [target, ...rest] = inner.split('|');
  return {
    target: target.trim(),
    label: rest.length ? rest.join('|').trim() : null,
  };
}

function makeGlossaryLink(target, label, terms, file, base) {
  const term = terms.get(target);
  if (!term) {
    throw new Error(
      `[remark-guide-links] 未登録の用語「${target}」が ${file ?? 'unknown'} にあります。src/data/glossary.json を確認してください。`,
    );
  }
  return {
    type: 'link',
    url: `${base}/glossary/${term.slug}/`,
    title: term.term,
    data: {
      hProperties: {
        className: ['gloss-link'],
        'data-gloss': term.slug,
      },
    },
    children: [{ type: 'text', value: label || term.term }],
  };
}

function makeChapterLink(target, label, chapters, pages, file, base) {
  const raw = target.slice(3).replace(/^\/+|\/+$/g, '');
  const [chapterId, pageSlug] = raw.split('/');
  const chapter = chapters.get(chapterId);
  if (!chapter) {
    throw new Error(
      `[remark-guide-links] 未登録の章「${target}」が ${file ?? 'unknown'} にあります。`,
    );
  }

  if (!pageSlug) {
    return {
      type: 'link',
      url: `${base}/chapters/${chapterId}/`,
      title: chapter.title,
      data: { hProperties: { className: ['xref-link'] } },
      children: [
        {
          type: 'text',
          value: label || `第${chapterId}章 ${chapter.shortTitle}`,
        },
      ],
    };
  }

  const id = `${chapterId}/${pageSlug}`;
  const pageTitle = pages.get(id);
  if (!pageTitle) {
    throw new Error(
      `[remark-guide-links] 未登録のページ「${target}」が ${file ?? 'unknown'} にあります。src/content/chapters/${id}.mdx が存在するか確認してください。`,
    );
  }
  return {
    type: 'link',
    url: `${base}/chapters/${chapterId}/${pageSlug}/`,
    title: pageTitle,
    data: { hProperties: { className: ['xref-link'] } },
    children: [{ type: 'text', value: label || pageTitle }],
  };
}

function splitTextNode(value, file, base) {
  const { chapters, terms, pages } = loadGuide();
  const out = [];
  let last = 0;
  WIKI_LINK.lastIndex = 0;
  let match;

  while ((match = WIKI_LINK.exec(value))) {
    if (match.index > last) {
      out.push({ type: 'text', value: value.slice(last, match.index) });
    }
    const { target, label } = parseInner(match[1]);
    if (target.startsWith('ch:')) {
      out.push(makeChapterLink(target, label, chapters, pages, file, base));
    } else {
      out.push(makeGlossaryLink(target, label, terms, file, base));
    }
    last = match.index + match[0].length;
  }

  if (last === 0) return null;
  if (last < value.length) {
    out.push({ type: 'text', value: value.slice(last) });
  }
  return out;
}

const SKIP = new Set([
  'code',
  'inlineCode',
  'html',
  'yaml',
  'toml',
  'mdxjsEsm',
  'mdxFlowExpression',
  'mdxTextExpression',
  'link',
  'linkReference',
]);

/** Markdown 内のサイト内絶対リンクに base を付ける（<base> タグを使わないため）。 */
function prefixInternalLinks(node, base) {
  if (!Array.isArray(node.children)) return;
  for (const child of node.children) {
    if (
      (child.type === 'link' || child.type === 'image') &&
      typeof child.url === 'string' &&
      child.url.startsWith('/') &&
      !child.url.startsWith('//') &&
      !child.url.startsWith(`${base}/`)
    ) {
      child.url = `${base}${child.url}`;
    }
    prefixInternalLinks(child, base);
  }
}

function transform(node, file, base) {
  if (!Array.isArray(node.children)) return;

  const next = [];
  for (const child of node.children) {
    if (child.type === 'text') {
      const replacement = splitTextNode(child.value, file, base);
      if (replacement) next.push(...replacement);
      else next.push(child);
      continue;
    }

    if (SKIP.has(child.type)) {
      next.push(child);
      continue;
    }

    transform(child, file, base);
    next.push(child);
  }
  node.children = next;
}

/**
 * [[term]] / [[term|表示]]        → 用語辞典へのリンク（data-gloss 付き）
 * [[ch:04]] / [[ch:04/slug]]      → 章・ページへのリンク
 *
 * 用語・章・ページが存在しない場合はビルドを止める。リンク切れを
 * 公開前に見つけるための仕組み。
 */
export default function remarkGuideLinks(options = {}) {
  // base は astro.config.mjs から渡す。設定を一か所にまとめるため、
  // ここでも手元の IP や日付入りパスは持たない。
  const base = normalizeBase(options.base);
  return (tree, file) => {
    prefixInternalLinks(tree, base);
    transform(tree, file?.path, base);
  };
}

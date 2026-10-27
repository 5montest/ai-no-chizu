#!/usr/bin/env node
/**
 * 記事データの整合性チェック。
 *
 * ビルドすると落ちる種類の誤り（存在しない図・用語・章への参照）と、
 * ビルドは通るが公開後に困る誤り（正解番号のずれ、空の選択肢、
 * 効果のない内部リンク）を、まとめて先に見つける。
 *
 *   node scripts/validate-content.mjs [--root ディレクトリ]
 *
 * 問題が1件でもあれば終了コード1を返す。CI と手元の両方で使う。
 * --root はテスト用。本物のデータ以外の小さな見本に対して同じ検査を走らせる。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const rootArgIndex = process.argv.indexOf('--root');
const ROOT =
  rootArgIndex > -1 && process.argv[rootArgIndex + 1]
    ? path.resolve(process.argv[rootArgIndex + 1])
    : path.resolve(SCRIPT_DIR, '..');
const CONTENT = path.join(ROOT, 'src/content/chapters');

const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

const curriculum = readJson('src/data/curriculum.json');
const glossary = readJson('src/data/glossary.json');
const { diagrams } = await import(path.join(ROOT, 'src/data/diagrams.ts'));

const errors = [];
const warnings = [];

function fail(file, message) {
  errors.push(`${file}: ${message}`);
}

function warn(file, message) {
  warnings.push(`${file}: ${message}`);
}

/** MDX を「frontmatter」と「本文」に分ける。 */
function splitFrontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return null;
  return { frontmatter: match[1], body: source.slice(match[0].length) };
}

function listMdx() {
  return fs
    .readdirSync(CONTENT, { recursive: true })
    .map(String)
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => file.split(path.sep).join('/'))
    .sort();
}

// ---- 参照先の索引 -------------------------------------------------------

const chapterById = new Map(curriculum.chapters.map((chapter) => [chapter.id, chapter]));
const termBySlug = new Map(glossary.terms.map((term) => [term.slug, term]));

const files = listMdx();
const pages = new Map(); // '04/01-pipeline' -> { chapter, title }

for (const file of files) {
  const id = file.replace(/\.mdx$/, '');
  const split = splitFrontmatter(fs.readFileSync(path.join(CONTENT, file), 'utf8'));
  if (!split) {
    fail(`src/content/chapters/${file}`, 'frontmatter がありません');
    continue;
  }
  let data;
  try {
    data = YAML.parse(split.frontmatter);
  } catch (error) {
    fail(`src/content/chapters/${file}`, `frontmatter を解釈できません: ${error.message}`);
    continue;
  }
  pages.set(id, { chapter: data.chapter, title: data.title });
}

/** サイト内の実在するパス（base を除いた形）。 */
function buildRoutes() {
  const routes = new Set(['/', '/404/', '/about/', '/chapters/', '/glossary/', '/quiz/', '/search.json']);

  for (const chapter of curriculum.chapters) {
    routes.add(`/chapters/${chapter.id}/`);
    routes.add(`/glossary/#${chapter.id}`);
  }
  for (const [id, page] of pages) {
    const [chapterId, slug] = id.split('/');
    routes.add(`/chapters/${chapterId}/${slug}/`);
    if (page.chapter !== chapterId) {
      fail(
        `src/content/chapters/${id}.mdx`,
        `配置が第${chapterId}章のディレクトリですが、frontmatter の chapter は「${page.chapter}」です`,
      );
    }
  }
  for (const term of glossary.terms) {
    routes.add(`/glossary/${term.slug}/`);
  }
  return routes;
}

const routes = buildRoutes();

/** 末尾スラッシュや #fragment を落として比較する。 */
function normalizePath(url) {
  const withoutHash = url.split('#')[0];
  const withoutQuery = withoutHash.split('?')[0];
  if (withoutQuery === '') return null; // ページ内アンカーだけのリンク
  return withoutQuery.endsWith('/') || withoutQuery.includes('.') ? withoutQuery : `${withoutQuery}/`;
}

// ---- 各記事の検査 -------------------------------------------------------

for (const file of files) {
  const rel = `src/content/chapters/${file}`;
  const split = splitFrontmatter(fs.readFileSync(path.join(CONTENT, file), 'utf8'));
  if (!split) continue;

  let data;
  try {
    data = YAML.parse(split.frontmatter);
  } catch {
    continue; // 上の索引づくりで報告済み
  }

  // クイズ: 正解番号が選択肢の範囲に収まっているか。
  // 表示時に選択肢を並べ替えるため、番号そのものは「元の並びでの正解」を指す。
  if (Array.isArray(data.quiz)) {
    data.quiz.forEach((quiz, index) => {
      const label = `quiz[${index}]（${quiz?.question ?? '設問なし'}）`;
      const options = Array.isArray(quiz?.options) ? quiz.options : [];

      if (options.length < 2 || options.length > 4) {
        fail(rel, `${label}: 選択肢は2〜4個にしてください（今は${options.length}個）`);
      }
      if (options.some((option) => typeof option !== 'string' || option.trim() === '')) {
        fail(rel, `${label}: 空の選択肢があります`);
      }
      if (new Set(options).size !== options.length) {
        fail(rel, `${label}: 同じ文の選択肢が重複しています`);
      }
      if (!Number.isInteger(quiz?.answer)) {
        fail(rel, `${label}: answer が整数ではありません`);
      } else if (quiz.answer < 0 || quiz.answer >= options.length) {
        fail(
          rel,
          `${label}: answer=${quiz.answer} は選択肢の範囲外です（0〜${options.length - 1}）`,
        );
      }
      if (typeof quiz?.explanation !== 'string' || quiz.explanation.trim() === '') {
        fail(rel, `${label}: explanation が空です`);
      }
    });
  } else {
    fail(rel, 'quiz がありません');
  }

  // 用語集: frontmatter の glossary は用語辞典に実在する slug か。
  if (Array.isArray(data.glossary)) {
    for (const slug of data.glossary) {
      if (!termBySlug.has(slug)) {
        fail(rel, `glossary に未登録の用語「${slug}」があります（src/data/glossary.json）`);
      }
    }
  }

  // 本文中の [[...]] リンク。
  for (const match of split.body.matchAll(/\[\[([^\]\n]+)\]\]/g)) {
    const target = match[1].split('|')[0].trim();
    if (!target) {
      fail(rel, '空の [[ ]] リンクがあります');
      continue;
    }
    if (target.startsWith('ch:')) {
      const raw = target.slice(3).replace(/^\/+|\/+$/g, '');
      const [chapterId, slug] = raw.split('/');
      if (!chapterById.has(chapterId)) {
        fail(rel, `[[${target}]]: 第${chapterId}章は curriculum.json にありません`);
      } else if (slug && !pages.has(`${chapterId}/${slug}`)) {
        fail(rel, `[[${target}]]: ページ src/content/chapters/${chapterId}/${slug}.mdx がありません`);
      }
    } else if (!termBySlug.has(target)) {
      fail(rel, `[[${target}]]: 用語辞典に「${target}」がありません`);
    }
  }

  // 図: 登録済みの名前か。caption の指定があれば空でないか。
  for (const match of split.body.matchAll(/<Diagram\b[^>]*>/g)) {
    const tag = match[0];
    const name = tag.match(/name="([^"]*)"/)?.[1] ?? tag.match(/name='([^']*)'/)?.[1];
    if (!name) {
      fail(rel, `<Diagram> に name がありません: ${tag}`);
      continue;
    }
    if (!Object.hasOwn(diagrams, name)) {
      fail(rel, `<Diagram name="${name}"> は src/data/diagrams.ts にありません`);
    }
    const caption = tag.match(/caption="([^"]*)"/)?.[1];
    if (caption !== undefined && caption.trim() === '') {
      fail(rel, `<Diagram name="${name}"> の caption が空です（省略すれば既定の但し書きが出ます）`);
    }
  }

  // 内部リンク: 実在するページを指しているか。
  const linkTargets = [
    ...[...split.body.matchAll(/\]\((\/[^)\s]*)\)/g)].map((m) => m[1]),
    ...[...split.body.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]),
  ];
  for (const href of linkTargets) {
    if (href.startsWith('//')) continue;
    const normalized = normalizePath(href);
    if (!normalized) continue;
    if (!routes.has(normalized)) {
      fail(rel, `内部リンク「${href}」の行き先がありません`);
    }
  }
}

// ---- 図の登録内容 -------------------------------------------------------

for (const [name, diagram] of Object.entries(diagrams)) {
  const label = `src/data/diagrams.ts（${name}）`;
  if (!diagram.number || String(diagram.number).trim() === '') {
    fail(label, 'number が空です');
  }
  if (!diagram.title || String(diagram.title).trim() === '') {
    fail(label, 'title が空です');
  }
  // 図には「概念図」「数値は例示」などの但し書きを必ず付ける。
  if (!diagram.caption || String(diagram.caption).trim() === '') {
    fail(label, 'caption が空です。読み手が図の前提を誤らないよう但し書きを入れてください');
  }
  if (!diagram.code || String(diagram.code).trim() === '') {
    fail(label, 'code（Mermaid 定義）が空です');
  }
}

// ---- 用語集 -------------------------------------------------------------

const chapterIds = new Set(curriculum.chapters.map((chapter) => chapter.id));
const categoryIds = new Set(glossary.categories.map((category) => category.id));

for (const term of glossary.terms) {
  const label = `src/data/glossary.json（${term.slug}）`;
  if (!term.term || !term.short) {
    fail(label, 'term か short が空です');
  }
  if (!categoryIds.has(term.category)) {
    fail(label, `未登録のカテゴリ「${term.category}」です`);
  }
  for (const chapterId of term.chapters ?? []) {
    if (!chapterIds.has(chapterId)) {
      fail(label, `未登録の章「${chapterId}」を参照しています`);
    }
  }
  for (const related of term.related ?? []) {
    if (!termBySlug.has(related)) {
      warn(label, `関連用語「${related}」が glossary.json にありません`);
    }
  }
}

// ---- 結果 ---------------------------------------------------------------

for (const warning of warnings) {
  console.warn(`警告: ${warning}`);
}

if (errors.length) {
  console.error(`\n${errors.length}件の問題が見つかりました。\n`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `コンテンツ検証OK: 記事${files.length}件・用語${glossary.terms.length}件・図${Object.keys(diagrams).length}件`,
);

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

/**
 * 図鑑は本文の参照先としてだけ使う。--root の小さな見本には置かないため、
 * 無ければ空として扱う（図鑑そのものの検査は validate-zukan.mjs が受け持つ）。
 */
const readZukan = () => {
  const file = path.join(ROOT, 'data/zukan.json');
  if (!fs.existsSync(file)) return { entities: [] };
  return JSON.parse(fs.readFileSync(file, 'utf8'));
};

const curriculum = readJson('src/data/curriculum.json');
const glossary = readJson('src/data/glossary.json');
const zukan = readZukan();
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
  const routes = new Set([
    '/',
    '/404/',
    '/about/',
    '/start/',
    '/checklist/',
    '/chapters/',
    '/glossary/',
    '/practice/',
    '/quiz/',
    '/search.json',
    '/zukan/',
    '/zukan.json',
    '/zukan/compare/',
  ]);

  for (const chapter of curriculum.chapters) {
    routes.add(`/chapters/${chapter.id}/`);
    routes.add(`/glossary/#${chapter.id}`);
  }
  for (const entity of zukan.entities) {
    routes.add(`/zukan/${entity.slug}/`);
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
  const source = fs.readFileSync(path.join(CONTENT, file), 'utf8');
  const split = splitFrontmatter(source);
  if (!split) continue;

  // 表の行に [[用語|表示]] を素で書くと、| がセルの区切りとして先に解釈され、
  // 「[[用語」と「表示]]」が別のセルに分かれて崩れる。表の行では \| と書く。
  const lineOffset = source.split('\n').length - split.body.split('\n').length;
  split.body.split('\n').forEach((line, index) => {
    if (!line.startsWith('|')) return;
    for (const wiki of line.match(/\[\[[^\]\n]*\]\]/g) ?? []) {
      if (/(?<!\\)\|/.test(wiki)) {
        fail(
          rel,
          `${lineOffset + index + 1}行目: 表の中の ${wiki} は、| がセルの区切りとして解釈されます。[[用語\\|表示]] と書いてください`,
        );
      }
    }
  });

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

  // 出典: 読者が自分で確かめられる形になっているか。
  // ネットワークには出ないので、URL の形と「URL がないときの説明」だけを見る。
  const seenSourceUrls = new Map();
  for (const [index, source] of (Array.isArray(data.sources) ? data.sources : []).entries()) {
    const at = `sources[${index}]（${source?.title ?? 'title なし'}）`;
    if (typeof source?.title !== 'string' || source.title.trim() === '') {
      fail(rel, `sources[${index}]: title が空です`);
      continue;
    }

    if (source.url === undefined) {
      if (typeof source.note !== 'string' || source.note.trim() === '') {
        fail(rel, `${at}: URL がない場合は note に理由を書いてください`);
      }
      continue;
    }

    if (typeof source.url !== 'string' || !/^https?:\/\/[^\s]+$/.test(source.url)) {
      fail(rel, `${at}: url は http(s) の絶対URLにしてください: ${source.url}`);
      continue;
    }
    if (seenSourceUrls.has(source.url)) {
      fail(rel, `${at}: 同じ URL が sources[${seenSourceUrls.get(source.url)}] と重複しています`);
      continue;
    }
    seenSourceUrls.set(source.url, index);

    // http は読者の通信が平文になる。直せない事情がある場合だけ残す。
    if (source.url.startsWith('http://')) {
      warn(rel, `${at}: http の URL です（https で開けるか確認してください）: ${source.url}`);
    }
  }

  // 本文中の [[...]] リンク。表の中では区切りの | を \| と書くため、
  // 区切りの判定はエスケープされていない | だけを見る。
  for (const match of split.body.matchAll(/\[\[([^\]\n]+)\]\]/g)) {
    const target = match[1].split('|')[0].replace(/\\$/, '').trim();
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

// ---- 学習ルート ---------------------------------------------------------

/**
 * 学習ルートはトップページと /start/ の導線そのもの。参照先の記事が消えると、
 * 押した先が404になる。--root の小さな見本には置かないため、無ければ飛ばす。
 */
const readingPathsFile = path.join(ROOT, 'src/data/reading-paths.ts');
if (fs.existsSync(readingPathsFile)) {
  const { readingPaths } = await import(readingPathsFile);
  const seenPathIds = new Set();

  for (const route of readingPaths) {
    const label = `src/data/reading-paths.ts（${route.id ?? 'id なし'}）`;
    if (!route.id || String(route.id).trim() === '') {
      fail(label, 'id が空です');
      continue;
    }
    if (seenPathIds.has(route.id)) {
      fail(label, `ルートの id「${route.id}」が重複しています`);
    }
    seenPathIds.add(route.id);

    for (const key of ['label', 'title', 'description', 'outcome', 'prerequisite']) {
      if (typeof route[key] !== 'string' || route[key].trim() === '') {
        fail(label, `${key} が空です`);
      }
    }

    const pageIds = new Set();
    for (const page of route.pages ?? []) {
      if (pageIds.has(page.id)) {
        fail(label, `ページ「${page.id}」を同じルートで2回参照しています`);
      }
      pageIds.add(page.id);
      if (!pages.has(page.id)) {
        fail(label, `参照先 src/content/chapters/${page.id}.mdx がありません`);
      }
      if (typeof page.reason !== 'string' || page.reason.trim() === '') {
        fail(label, `ページ「${page.id}」の reason が空です`);
      }
    }
    if (pageIds.size === 0) {
      fail(label, 'pages が空です');
    }

    // before は、ルートの順番には含めない補助リンク。記事が消えると押し先が404になる。
    for (const page of route.pages ?? []) {
      for (const ref of page.before ?? []) {
        if (!pages.has(ref.id)) {
          fail(label, `補助リンクの参照先 src/content/chapters/${ref.id}.mdx がありません`);
        }
        if (typeof ref.note !== 'string' || ref.note.trim() === '') {
          fail(label, `補助リンク「${ref.id}」の note が空です`);
        }
      }
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

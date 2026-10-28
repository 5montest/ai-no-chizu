import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { readingPaths } from '../src/data/reading-paths.ts';

/**
 * 学習ルートのテスト。
 *
 * ルートはトップページと /start/ の導線そのものなので、参照先の記事が消えると
 * 押した先が404になる。記事の入れ替えで壊れたときに、ビルドより先に気づける
 * ようにしておく。
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const CHAPTERS = path.join(ROOT, 'src/content/chapters');

/** 実際に置かれている記事の ID（'04/01-pipeline' の形）。 */
function listPageIds() {
  return new Set(
    fs
      .readdirSync(CHAPTERS, { recursive: true })
      .map(String)
      .filter((file) => file.endsWith('.mdx'))
      .map((file) => file.split(path.sep).join('/').replace(/\.mdx$/, '')),
  );
}

test('学習ルートのIDは5つで、重複しない', () => {
  const ids = readingPaths.map((route) => route.id);
  assert.deepEqual([...ids].sort(), ['build', 'decide', 'learn', 'read', 'use']);
  assert.equal(new Set(ids).size, ids.length, '同じ id のルートがあります');
});

test('各ルートに、行き先と学ぶ内容が書かれている', () => {
  for (const route of readingPaths) {
    for (const key of ['label', 'title', 'description', 'outcome', 'prerequisite'] as const) {
      assert.ok(
        typeof route[key] === 'string' && route[key].trim() !== '',
        `${route.id} の ${key} が空です`,
      );
    }
    assert.ok(route.pages.length > 0, `${route.id} にページがありません`);
  }
});

test('各ルートの参照先は、実在する記事と1対1で対応する', () => {
  const pageIds = listPageIds();

  for (const route of readingPaths) {
    const seen = new Set<string>();
    for (const page of route.pages) {
      assert.ok(
        !seen.has(page.id),
        `${route.id} が同じページ「${page.id}」を2回参照しています`,
      );
      seen.add(page.id);

      assert.ok(
        pageIds.has(page.id),
        `${route.id} の参照先 src/content/chapters/${page.id}.mdx がありません` +
          '（記事を移した・消した場合は src/data/reading-paths.ts の id も直してください）',
      );
      assert.ok(page.reason.trim() !== '', `${route.id} の「${page.id}」に理由がありません`);
    }
  }
});

test('補助リンク（先に読むと分かりやすい記事）も、実在する記事を指す', () => {
  const pageIds = listPageIds();

  for (const route of readingPaths) {
    // ルートの順番に入れた記事を補助リンクで繰り返すと、読む順が二重に見える。
    const inRoute = new Set(route.pages.map((page) => page.id));
    const seen = new Set<string>();

    for (const page of route.pages) {
      for (const ref of page.before ?? []) {
        assert.ok(
          pageIds.has(ref.id),
          `${route.id} の「${page.id}」から補助リンクしている src/content/chapters/${ref.id}.mdx がありません`,
        );
        assert.ok(
          ref.note.trim() !== '',
          `${route.id} の補助リンク「${ref.id}」に、なぜ先に読むかの説明がありません`,
        );
        assert.ok(
          !inRoute.has(ref.id),
          `${route.id} の補助リンク「${ref.id}」は、同じルートの本文ページでもあります`,
        );
        assert.ok(
          !seen.has(ref.id),
          `${route.id} で補助リンク「${ref.id}」が2回出てきます`,
        );
        seen.add(ref.id);
      }
    }
  }
});

test('5つの入口（仕組み・利用・比較・導入・実装）がそろっている', () => {
  // どれか1つが消えると、その目的の読者は入口を失う。
  const ids = new Set<string>(readingPaths.map((route) => route.id));
  for (const id of ['learn', 'use', 'read', 'decide', 'build']) {
    assert.ok(ids.has(id), `ルート「${id}」がありません`);
  }
});

test('ターミナルとGitを前提にするのは実装ルートだけ', () => {
  const requiring = readingPaths.filter((route) => /Git|ターミナル/.test(route.prerequisite));
  assert.deepEqual(
    requiring.map((route) => route.id),
    ['build'],
    '前提条件の書き分けが崩れています（初学者向けルートに開発前提が混ざっていないか確認）',
  );
});

test('ルートの参照先は、curriculum.json にある章に属する', () => {
  const curriculum = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'src/data/curriculum.json'), 'utf8'),
  );
  const chapterIds = new Set(curriculum.chapters.map((chapter: { id: string }) => chapter.id));

  for (const route of readingPaths) {
    for (const page of route.pages) {
      const [chapterId] = page.id.split('/');
      assert.ok(
        chapterIds.has(chapterId),
        `${route.id} の参照先「${page.id}」は第${chapterId}章ですが、curriculum.json にありません`,
      );
    }
  }
});

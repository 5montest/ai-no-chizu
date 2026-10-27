import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { buildCourseOrder, neighbours, toNavItem } from '../src/lib/course-nav.mjs';

/**
 * 章をまたぐ学習順のテスト。
 *
 * 実際に起きた問題は「章の最後で次のページへの導線が消える」ことと、
 * 「未公開の章へリンクが張られる」こと。どちらもビルドせずに再現できる。
 */

const curriculum = JSON.parse(
  fs.readFileSync(new URL('../src/data/curriculum.json', import.meta.url), 'utf8'),
);

// curriculum と同じ形の最小データ。公開中の章だけを並べる。
const miniCurriculum = {
  chapters: [
    { id: '01', status: 'published', title: 'AIとは何か', shortTitle: 'AIとは何か' },
    { id: '02', status: 'planned', title: 'AIの歴史', shortTitle: 'AIの歴史' },
    { id: '04', status: 'published', title: 'LLMとは何か', shortTitle: 'LLMとは何か' },
    { id: '05', status: 'published', title: 'トークンとベクトル', shortTitle: 'トークンとベクトル' },
  ],
};

function page(chapter: string, slug: string, order: number, title = `${chapter}-${slug}`) {
  return { id: `${chapter}/${slug}`, data: { chapter, order, title } };
}

const miniEntries = [
  page('01', '02-ml', 2),
  page('01', '01-what', 1),
  page('02', '01-history', 1), // 未公開の章のページ
  page('04', '01-pipeline', 1),
  page('05', '01-token', 1),
];

/**
 * 「あるはず」の値を取り出す。無ければテストをそこで止める。
 * 中身の確認は各テストに任せ、ここでは null / undefined の検査だけを引き受ける。
 */
function expect<T>(value: T | null | undefined, label: string): T {
  assert.ok(value != null, `${label}が見つかりません`);
  return value;
}

type CourseOrder = ReturnType<typeof buildCourseOrder>;

function positionOf(order: CourseOrder, id: string) {
  return expect(neighbours(order, id), `${id} の学習順`);
}

test('公開中の章だけを curriculum の順に並べる', () => {
  const order = buildCourseOrder(miniEntries, miniCurriculum);
  assert.deepEqual(
    order.map((item) => item.id),
    ['01/01-what', '01/02-ml', '04/01-pipeline', '05/01-token'],
  );
});

test('並びは curriculum の順で、ページ内は order の昇順', () => {
  // 入力の並びを逆にしても結果が変わらないこと。
  const order = buildCourseOrder([...miniEntries].reverse(), miniCurriculum);
  assert.deepEqual(
    order.map((item) => item.id),
    ['01/01-what', '01/02-ml', '04/01-pipeline', '05/01-token'],
  );
});

test('未公開の章のページは、前後の候補にもならない', () => {
  const order = buildCourseOrder(miniEntries, miniCurriculum);
  const ids = order.map((item) => item.id);
  assert.ok(!ids.includes('02/01-history'), '未公開の章のページが混ざっている');

  const position = positionOf(order, '01/02-ml');
  assert.equal(expect(position.next, '次のページ').id, '04/01-pipeline');
});

test('章の最後のページから次の章の最初のページへ進める', () => {
  const order = buildCourseOrder(miniEntries, miniCurriculum);
  const position = positionOf(order, '01/02-ml');
  assert.equal(expect(position.prev, '前のページ').id, '01/01-what');
  assert.equal(expect(position.next, '次のページ').id, '04/01-pipeline');
  assert.equal(position.endsChapter, true);

  const next = expect(toNavItem(position.next, '01', '/base'), '次のページの項目');
  assert.equal(next.href, '/base/chapters/04/01-pipeline/');
  assert.equal(next.crossesChapter, true);
  assert.equal(next.chapterLabel, '第04章 LLMとは何か');
});

test('同じ章の中の移動では章名を添えない', () => {
  const order = buildCourseOrder(miniEntries, miniCurriculum);
  const position = positionOf(order, '01/01-what');
  const next = expect(toNavItem(position.next, '01', '/base'), '次のページの項目');
  assert.equal(next.crossesChapter, false);
});

test('最初と最後のページでは、存在しない前後を作らない', () => {
  const order = buildCourseOrder(miniEntries, miniCurriculum);

  const first = positionOf(order, '01/01-what');
  assert.equal(first.prev, null);
  assert.equal(toNavItem(first.prev, '01', ''), undefined);

  const last = positionOf(order, '05/01-token');
  assert.equal(last.next, null);
  assert.equal(toNavItem(last.next, '05', ''), undefined);
});

test('学習順の位置と総数が、各ページの表示と一致する', () => {
  const order = buildCourseOrder(miniEntries, miniCurriculum);
  assert.equal(order.length, 4);
  for (const [index, item] of order.entries()) {
    assert.equal(item.indexInCourse, index + 1);
    assert.equal(item.totalInCourse, 4);
  }

  const second = expect(positionOf(order, '01/02-ml').current, '現在のページ');
  assert.equal(second.indexInChapter, 2);
  assert.equal(second.pagesInChapter, 2);
});

test('同じ order のページがあっても並びが入れ替わらない', () => {
  const duplicated = [page('01', 'b', 1), page('01', 'a', 1)];
  const order = buildCourseOrder(duplicated, miniCurriculum);
  assert.deepEqual(
    order.map((item) => item.id),
    ['01/b', '01/a'],
  );
});

test('実データでは公開中の19ページが学習順になる', () => {
  // 章の一覧は実ファイル、ページは各章のページ数だけを与える。
  const counts = { '01': 3, '04': 3, '05': 3, '06': 4, '12': 3, '18': 3 };
  const entries = Object.entries(counts).flatMap(([chapter, count]) =>
    Array.from({ length: count }, (_, i) => page(chapter, `p${i + 1}`, i + 1)),
  );

  const order = buildCourseOrder(entries, curriculum);
  assert.equal(order.length, 19);
  assert.equal(order[0].chapterId, '01');
  assert.equal(expect(order.at(-1), '最後のページ').chapterId, '18');
  assert.ok(
    order.every((item) => item.totalInCourse === 19),
    '総ページ数が全ページでそろっていない',
  );

  // 未公開の章（03, 07 など）が混ざっていないこと。
  const publishedIds = new Set(
    curriculum.chapters
      .filter((c: { status: string }) => c.status === 'published')
      .map((c: { id: string }) => c.id),
  );
  assert.ok(order.every((item) => publishedIds.has(item.chapterId)));
});

test('ページが1枚もない章は飛ばす', () => {
  const entries = [page('01', 'only', 1)];
  const order = buildCourseOrder(entries, miniCurriculum);
  assert.deepEqual(
    order.map((item) => item.id),
    ['01/only'],
  );
});

test('学習順にない ID では null を返す', () => {
  const order = buildCourseOrder(miniEntries, miniCurriculum);
  assert.equal(neighbours(order, '02/01-history'), null);
});

/**
 * 章をまたいだ学習順の組み立て。
 *
 * ページ内の「前へ／次へ」を章の中で閉じると、章の最後で読み進める先が
 * 消える。ここでは公開中の章だけを curriculum の順に並べ、章の境界を
 * 越えた前後を返す。未公開の章は候補に含めない（リンク切れを作らない）。
 */

/**
 * @param {Array<{ id: string, data: { chapter: string, order: number, title: string } }>} entries
 * @param {{ chapters: Array<{ id: string, status: string, title: string, shortTitle?: string }> }} curriculum
 * @returns {Array<{ id: string, chapterId: string, slug: string, title: string, path: string,
 *   chapterTitle: string, chapterTitleFull: string, indexInChapter: number,
 *   pagesInChapter: number, indexInCourse: number, totalInCourse: number }>}
 */
export function buildCourseOrder(entries, curriculum) {
  const published = new Map(
    curriculum.chapters
      .filter((chapter) => chapter.status === 'published')
      .map((chapter) => [chapter.id, chapter]),
  );

  const pagesByChapter = new Map();
  for (const entry of entries) {
    const [chapterId, slug] = String(entry.id).split('/');
    if (!published.has(chapterId)) continue;
    if (!pagesByChapter.has(chapterId)) pagesByChapter.set(chapterId, []);
    pagesByChapter.get(chapterId).push({
      id: entry.id,
      chapterId,
      slug,
      title: entry.data.title,
      order: entry.data.order,
      path: `/chapters/${chapterId}/${slug}/`,
    });
  }

  const order = [];
  for (const chapter of curriculum.chapters) {
    if (!published.has(chapter.id)) continue;
    const pages = (pagesByChapter.get(chapter.id) ?? []).sort((a, b) => a.order - b.order);
    pages.forEach((page, indexInChapter) => {
      order.push({
        ...page,
        chapterTitle: chapter.shortTitle ?? chapter.title,
        chapterTitleFull: chapter.title,
        indexInChapter: indexInChapter + 1,
        pagesInChapter: pages.length,
        indexInCourse: order.length + 1,
        totalInCourse: 0, // 最後に埋める
      });
    });
  }

  return order.map((item) => ({ ...item, totalInCourse: order.length }));
}

/**
 * 学習順の中での前後と位置を返す。見つからないときは null。
 */
export function neighbours(order, id) {
  const index = order.findIndex((item) => item.id === id);
  if (index === -1) return null;
  const current = order[index];
  return {
    current,
    prev: order[index - 1] ?? null,
    next: order[index + 1] ?? null,
    // 章の境目かどうかは、前後の章 ID を見れば分かる。
    startsChapter: index === 0 || order[index - 1].chapterId !== current.chapterId,
    endsChapter: index === order.length - 1 || order[index + 1].chapterId !== current.chapterId,
  };
}

/** PageNav に渡す形へ整える。label は章をまたぐときだけ添える。 */
export function toNavItem(item, currentChapterId, base) {
  if (!item) return undefined;
  return {
    href: `${base}${item.path}`,
    title: item.title,
    chapterId: item.chapterId,
    chapterLabel: `第${item.chapterId}章 ${item.chapterTitle}`,
    crossesChapter: item.chapterId !== currentChapterId,
  };
}

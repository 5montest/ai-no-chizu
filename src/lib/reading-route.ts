import type { ReadingPath } from '../data/reading-paths';

export function readingRouteHref(base: string, pageId: string, routeId: string) {
  return `${base}/chapters/${pageId}/?route=${encodeURIComponent(routeId)}`;
}

/** URLで明示されたルートだけを使う。別の入口で開いた記事の章順は変えない。 */
export function readingRoutePosition(paths: ReadingPath[], pageId: string, routeId: string | null) {
  const path = paths.find(item => item.id === routeId);
  if (!path) return null;
  const index = path.pages.findIndex(page => page.id === pageId);
  if (index < 0) return null;
  return { path, index, prev: path.pages[index - 1] ?? null, next: path.pages[index + 1] ?? null };
}

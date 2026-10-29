import test from 'node:test';
import assert from 'node:assert/strict';
import { readingPaths } from '../src/data/reading-paths.ts';
import { readingRouteHref, readingRoutePosition } from '../src/lib/reading-route.ts';

test('選択したルートを章をまたいで進み、戻れる', () => {
  const first = readingRoutePosition(readingPaths, '01/01-what-is-ai', 'learn');
  assert.equal(first?.next?.id, '04/01-pipeline');
  assert.equal(first?.prev, null);
  const second = readingRoutePosition(readingPaths, first!.next!.id, 'learn');
  assert.equal(second?.prev?.id, '01/01-what-is-ai');
  assert.equal(second?.next?.id, '06/02-attention');
});
test('最終記事には次がなく、全ルートの前後が正しい', () => {
  for (const path of readingPaths) for (let i = 0; i < path.pages.length; i++) {
    const state = readingRoutePosition(readingPaths, path.pages[i].id, path.id)!;
    assert.equal(state.index, i);
    assert.equal(state.prev?.id, path.pages[i - 1]?.id);
    assert.equal(state.next?.id, path.pages[i + 1]?.id);
  }
});
test('直接閲覧・不正なルート・ルート外の記事は通常の章順を使う', () => {
  for (const route of [null, 'unknown', '__proto__', 'use']) assert.equal(readingRoutePosition(readingPaths, '01/01-what-is-ai', route), null);
});
test('公開先のサブパスとルートを前後のURLに残す', () => {
  assert.equal(readingRouteHref('/ai-no-chizu', '04/01-pipeline', 'learn'), '/ai-no-chizu/chapters/04/01-pipeline/?route=learn');
  assert.equal(readingRouteHref('', '04/01-pipeline', 'learn'), '/chapters/04/01-pipeline/?route=learn');
});

/**
 * サイトのメタ情報と、公開先パスの解決。
 *
 * ベースパスの出所は astro.config.mjs の設定ひとつだけにする。Astro は
 * ビルド時に `import.meta.env.BASE_URL` へその値を渡すので、ここでは
 * それを読む。手元の IP アドレスや日付入りのパスをこのファイルへ
 * 書かないことで、サブパス配信から独自ドメインへ移しても直す場所が
 * 設定ファイルだけで済む。
 */

const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};

/** 設定していないときの配信先。`SITE_ORIGIN` / `SITE_BASE` で上書きできる。 */
export const DEFAULT_ORIGIN = 'http://192.168.8.10:8090';
export const DEFAULT_BASE = '/20261027-website-design-implementation/site';

/** `foo/` `/foo/` `/` などを `/foo` `/` `` にそろえる。 */
export function normalizeBase(value) {
  if (!value) return '';
  const trimmed = String(value).trim();
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withSlash === '/' ? '' : withSlash.replace(/\/+$/, '');
}

const envBase =
  env.BASE_URL ??
  (typeof process !== 'undefined' ? process.env?.SITE_BASE : undefined) ??
  DEFAULT_BASE;

/** このサイトのベースパス（末尾スラッシュなし。ルート配信なら空文字）。 */
export const BASE = normalizeBase(envBase);

export const SITE = {
  name: 'AIの地図',
  tagline: 'AI・LLMの原理から、製品選びと実装まで',
  description:
    'AIの技術解説ガイド。AI・機械学習・LLMの原理から、モデルや製品の選び方、エージェントによる実装まで、図と短いページで体系的に学ぶ。',
  author: 'AIの地図 編集部',
  published: '2026-10-27',
  updated: '2026-10-28',
};

/** サイト内の絶対パスにベースを付ける。`withBase('/chapters/')` */
export function withBase(pathname = '/') {
  const clean = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (clean === '/') return `${BASE}/`;
  return `${BASE}${clean}`;
}

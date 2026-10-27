/**
 * モデル比較表の並び順。
 *
 * 表示側（Astro）と操作側（ブラウザ）で同じ規則を使うため、比較処理をここに置く。
 * 初期表示もこの規則で並べるので、JavaScript が動かない環境でも
 * 「価格ボタンが選ばれているのに安い順になっていない」状態にならない。
 */

export type SortKey = 'price' | 'context' | 'name';

export const SORT_KEYS: SortKey[] = ['price', 'context', 'name'];

export interface SortableModel {
  id: string;
  name: string;
  context: number;
  price: number;
}

/** 同値のときは名前、それも同じなら id で決める（並びが毎回変わらないように）。 */
function byName(a: SortableModel, b: SortableModel) {
  return a.name.localeCompare(b.name, 'ja') || a.id.localeCompare(b.id);
}

export function compareModels(key: SortKey, a: SortableModel, b: SortableModel) {
  if (key === 'name') return byName(a, b);
  if (key === 'context') return b.context - a.context || byName(a, b);
  return a.price - b.price || byName(a, b);
}

/**
 * 元の配列は変更しない。並べ替え対象の型はそのまま返す。
 * ブラウザ側では行の DOM 要素を、ビルド側では表のデータを同じ関数に通すため、
 * 追加の項目（row など）は呼び出し元の型のまま保たれる。
 */
export function sortModels<T extends SortableModel>(key: SortKey, models: readonly T[]): T[] {
  return [...models].sort((a, b) => compareModels(key, a, b));
}

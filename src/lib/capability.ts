/**
 * 評価軸のスナップショット（data/capability-snapshots.json）を表示するための処理。
 *
 * 並び順と表記をコンポーネントの外に出しておき、テストから同じ関数を呼べるようにする。
 */

export const MODALITY_ORDER: readonly string[] = ['text', 'image', 'video', 'audio', 'file'];

export const MODALITY_LABELS: Record<string, string> = {
  text: 'テキスト',
  image: '画像',
  video: '動画',
  audio: '音声',
  file: 'ファイル',
};

export interface ModelRef {
  vendor: string;
  name: string;
}

/**
 * 提供元→名前の順に並べる。価格や能力の順位とは無関係であることを、
 * テストで「価格順と一致しない」ことまで確かめる。
 */
export function sortModelsByVendorName<T extends ModelRef>(models: readonly T[]): T[] {
  return [...models].sort(
    (a, b) => a.vendor.localeCompare(b.vendor, 'en') || a.name.localeCompare(b.name, 'en'),
  );
}

export function formatModalities(codes: readonly string[]): string {
  return [...codes]
    .sort((a, b) => MODALITY_ORDER.indexOf(a) - MODALITY_ORDER.indexOf(b))
    .map((code) => MODALITY_LABELS[code] ?? code)
    .join('・');
}

export interface ReasoningValue {
  mandatory: boolean;
  default_effort: string;
  supported_efforts: string[];
}

/**
 * 一覧の reasoning 欄を、表に出す3つの文字列に分ける。
 * 「無効化できる」とは、選べる effort に none がある場合だけ書く。
 */
export function formatReasoning(value: ReasoningValue): {
  mode: string;
  defaultEffort: string;
  efforts: string;
} {
  const canDisable = value.supported_efforts.includes('none');
  const mode = value.mandatory ? '常時' : canDisable ? '任意（none で無効化）' : '任意';
  return {
    mode,
    defaultEffort: value.default_effort,
    efforts: value.supported_efforts.join(' / '),
  };
}

export function formatJapaneseDate(value: string): string {
  const [year, month, day] = value.split('-');
  return `${Number(year)}年${Number(month)}月${Number(day)}日`;
}

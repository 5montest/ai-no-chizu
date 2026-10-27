/**
 * グラフの位置計算。
 *
 * 割合はビルド時に確定させ、ブラウザでは計算しない。値と位置の対応を
 * テストできるよう、計算だけをここに置く。
 */

/**
 * 単価の対数軸の範囲と目盛り。
 *
 * データの最小・最大がこの外に出ると点が枠から消える（か端に張り付く）ので、
 * データを更新したら test/chart-data.test.ts が先に落ちるようにしてある。
 */
export const PRICE_AXIS = {
  min: 0.08,
  max: 60,
  ticks: [0.1, 1, 10, 50],
} as const;

function toPercent(position: number): number {
  return Math.min(1, Math.max(0, position)) * 100;
}

/** 等間隔の軸での位置（0〜100）。 */
export function linearPercent(value: number, min: number, max: number): number {
  if (!(max > min)) {
    throw new Error(`軸の範囲が不正です: min=${min}, max=${max}`);
  }
  return toPercent((value - min) / (max - min));
}

/**
 * 対数軸での位置（0〜100）。
 *
 * 単価のように桁が大きく開く値を、線形軸で潰さずに並べるために使う。
 * 0 以下の値は対数を取れないので、呼び出し側のデータを疑って止める。
 */
export function logPercent(value: number, min: number, max: number): number {
  if (!(min > 0) || !(max > min)) {
    throw new Error(`対数軸の範囲が不正です: min=${min}, max=${max}`);
  }
  if (!(value > 0)) {
    throw new Error(`対数軸に0以下は置けません: ${value}`);
  }
  return toPercent((Math.log10(value) - Math.log10(min)) / (Math.log10(max) - Math.log10(min)));
}

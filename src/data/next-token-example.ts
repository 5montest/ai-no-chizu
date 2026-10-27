/**
 * 第04章「次のトークンを予測する」で使う確率分布の例。
 *
 * 記事の表とグラフが同じ値を使うよう、数値はここに一か所だけ置く。
 * 実際のモデルの出力ではなく、Softmax の計算を説明するための例である。
 */

export interface NextTokenCandidate {
  /** 表に出す正式な名前。 */
  label: string;
  /** グラフの行に出す短い名前。 */
  shortLabel: string;
  /** ロジット。残りの語彙をまとめた行は個別の値を持たない。 */
  logit: number | null;
  /**
   * まとめた行を1つの候補として Softmax にかけるときの実効ロジット。
   * 温度を動かす図（TemperatureExperiment）だけで使う。個々のロジットの
   * 代わりに合計を1行にまとめた値なので、記事の表には出さない。
   */
  aggregateLogit?: number;
  /** Softmax 後の確率。全候補の合計は1。 */
  probability: number;
}

export const nextTokenExample = {
  prompt: '今日の天気は',
  candidates: [
    { label: '晴れ', shortLabel: '晴れ', logit: 3.2, probability: 0.62 },
    { label: '雨', shortLabel: '雨', logit: 2.1, probability: 0.21 },
    { label: '全国', shortLabel: '全国', logit: 1.4, probability: 0.1 },
    {
      label: 'その他（残りの語彙すべて）',
      shortLabel: 'その他',
      logit: null,
      // 温度1で Softmax にかけたときに 0.07 になる実効値。
      // 記事の表は個々のロジットを並べず「—」にしている。
      aggregateLogit: 1.02,
      probability: 0.07,
    },
  ] satisfies NextTokenCandidate[],
  note: '数値は説明のための例です。実際の値はモデル・文脈・語彙によって変わります。',
  /**
   * 棒の目盛り。最大値に合わせて伸ばすのではなく、0〜0.7 で固定する。
   * 記事の例の最大値 0.62 がこの範囲に収まっていることをテストで確かめる。
   */
  axis: { min: 0, max: 0.7, ticks: [0, 0.2, 0.4, 0.6] },
};

/**
 * 温度の実験で Softmax にかけるロジット。
 *
 * まとめた行は実効ロジットを使う。抜けがあると図と表で値がずれるため、
 * ビルド時に止める（黙って0として扱わない）。
 */
export function softmaxLogits(): number[] {
  return nextTokenExample.candidates.map((candidate: NextTokenCandidate) => {
    if (candidate.logit !== null) return candidate.logit;
    if (typeof candidate.aggregateLogit === 'number') return candidate.aggregateLogit;
    throw new Error(`Softmax 用のロジットがありません: ${candidate.label}`);
  });
}

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

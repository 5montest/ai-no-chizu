/**
 * Softmax と温度。
 *
 * 温度の実験（TemperatureExperiment）と、そのテストで同じ計算を使う。
 * 図の中に数式を書き写すと、記事の表と図で値がずれるため、計算はここだけに置く。
 */

/**
 * ロジットを確率へ変換する。
 *
 * 温度で割ってから指数を取る。温度1が元の分布、1より小さいと尖り、
 * 大きいと平らになる。最大値を引いてから exp を取るのは、値が大きくても
 * 桁あふれしないようにするため（結果は変わらない）。
 */
export function softmax(logits: number[], temperature: number): number[] {
  if (!(temperature > 0)) {
    throw new Error(`温度は0より大きい値が必要です: ${temperature}`);
  }
  if (logits.length === 0) {
    throw new Error('ロジットが空です');
  }

  const max = Math.max(...logits);
  const exps = logits.map((logit) => Math.exp((logit - max) / temperature));
  const total = exps.reduce((sum, value) => sum + value, 0);
  return exps.map((value) => value / total);
}

/** 図に出す確率の表記（小数2桁）。 */
export function formatProbability(probability: number): string {
  return probability.toFixed(2);
}

/** 図に出す温度の表記（小数1桁）。 */
export function formatTemperature(temperature: number): string {
  return temperature.toFixed(1);
}

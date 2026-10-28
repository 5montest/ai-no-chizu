// cost.mjs — 文字数からトークン数を推定し、単価が入っていれば費用を出す。
// 単価は config.json に置く。未設定なら null を返し、0円とは書かない。

export function estimateTokens(text, charsPerToken) {
  if (!text) return 0;
  return Math.ceil(Array.from(text).length / charsPerToken);
}

export function estimateCost({ inputText, outputText, config }) {
  const { chars_per_token: charsPerToken, unit_price_input_per_1m: inPrice, unit_price_output_per_1m: outPrice } =
    config.cost;

  const inputTokens = estimateTokens(inputText, charsPerToken);
  const outputTokens = estimateTokens(outputText, charsPerToken);

  const priced = typeof inPrice === 'number' && typeof outPrice === 'number';
  const cost = priced ? (inputTokens * inPrice + outputTokens * outPrice) / 1_000_000 : null;

  return {
    inputTokens,
    outputTokens,
    cost,
    priced,
    priceSource: config.cost.price_source,
    priceCheckedAt: config.cost.price_checked_at,
  };
}

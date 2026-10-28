// text.mjs — 質問文とFAQ項目を、比較できる語の集合に変える。
// 日本語は語の区切りが無いので、正規化した文字列から2文字の組（バイグラム）を作る。
// 1文字の語（「鍵」「紙」）は、それだけでは索引の語にならない。この割り切りは
// README の「わかっている弱点」に書いてある。

const STRIP = /[\s、。,.!?！？「」『』（）()・:：;；\-—–~〜'"’”]/g;

export function normalize(input) {
  return String(input ?? '').normalize('NFKC').toLowerCase();
}

export function terms(input) {
  const normalized = normalize(input);
  const set = new Set();

  for (const word of normalized.match(/[a-z0-9]+/g) ?? []) {
    if (word.length > 1) set.add(word);
  }

  const chars = Array.from(normalized.replace(STRIP, ''));
  if (chars.length === 1) set.add(chars[0]);
  for (let i = 0; i < chars.length - 1; i += 1) {
    set.add(chars[i] + chars[i + 1]);
  }

  return [...set];
}

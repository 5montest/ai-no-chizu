// retrieval.mjs — 索引を作り、質問に近い項目を順位づけする。
// 使うのは足し算と割り算だけで、乱数も外部呼び出しも無い。同じ入力には同じ順位が返る。

import { terms } from './text.mjs';

export function buildIndex(entries) {
  const docs = entries.map((entry) => {
    const set = new Set(terms(`${entry.title} ${entry.when} ${entry.body}`));
    return { entry, set, size: set.size };
  });

  const df = new Map();
  for (const doc of docs) {
    for (const term of doc.set) df.set(term, (df.get(term) ?? 0) + 1);
  }

  // どの項目にも出る語は重みを下げ、一つの項目にしか出ない語は重みを上げる。
  const idf = new Map();
  for (const [term, dfCount] of df) {
    idf.set(term, Math.log((docs.length + 1) / (dfCount + 0.5)) + 1);
  }

  return { docs, idf };
}

export function rank(index, query) {
  const queryTerms = terms(query);
  const scored = index.docs
    .map((doc) => {
      let score = 0;
      let matched = 0;
      for (const term of queryTerms) {
        if (doc.set.has(term)) {
          score += index.idf.get(term) ?? 1;
          matched += 1;
        }
      }
      return {
        id: doc.entry.id,
        score: Math.round(score * 100) / 100,
        matched,
        coverage: queryTerms.length ? matched / queryTerms.length : 0,
      };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  const top = scored[0];
  const second = scored[1];
  const margin = top && top.score > 0 && second ? (top.score - second.score) / top.score : top ? 1 : 0;

  return {
    terms: queryTerms,
    ranked: scored,
    top,
    coverage: top?.coverage ?? 0,
    margin: Math.round(margin * 1000) / 1000,
  };
}

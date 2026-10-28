// engine.mjs — 索引・判定・組み立てを一つにまとめる。ブラウザとCLIはこれだけを使う。

import { buildIndex, rank } from './retrieval.mjs';
import { decide } from './routing.mjs';
import { estimateCost } from './cost.mjs';

const ESCALATION_CONTACT = '設備担当（内線 2100）';

export function createEngine({ entries, config }) {
  const index = buildIndex(entries);
  const byId = new Map(entries.map((entry) => [entry.id, entry]));

  function ask(query) {
    const ranked = rank(index, query);
    const decision = decide(query, ranked, config);
    const entry = decision.route === 'answer' ? byId.get(ranked.top.id) : null;

    let text;
    if (decision.route === 'answer') {
      text = `${entry.body}\n\n出典：${entry.source}`;
    } else if (decision.route === 'escalate') {
      text = `この質問は自動では答えません。${ESCALATION_CONTACT} へ連絡してください。`;
    } else {
      text = `手元のFAQに該当がありません。${ESCALATION_CONTACT} へ連絡してください。`;
    }

    const cost = estimateCost({
      inputText: entry ? `${query}\n${entry.body}` : query,
      outputText: text,
      config,
    });

    return {
      query,
      route: decision.route,
      reason: decision.reason,
      text,
      entry: entry ? { id: entry.id, title: entry.title, source: entry.source } : null,
      coverage: ranked.coverage,
      margin: ranked.margin,
      candidates: ranked.ranked.slice(0, 3),
      cost,
    };
  }

  return { ask, entries, index };
}

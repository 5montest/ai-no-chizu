// routing.mjs — 見つかった答えを渡すか、人に回すか、答えないかを決める。
// 判断は三つ。機微な語、候補の絞り込み具合（coverage）、一位と二位の差（margin）。

import { normalize } from './text.mjs';

// 「探せば答えが出るが、自動で答えてはいけない」語。金額・契約・個人・安全に関わる。
export const SENSITIVE_TERMS = [
  '返金',
  '支払',
  '契約',
  '給与',
  '個人情報',
  '懲戒',
  '訴訟',
  'けが',
  '怪我',
  '事故',
  '漏洩',
  'パスワード',
];

export function sensitiveHits(query) {
  const normalized = normalize(query);
  return SENSITIVE_TERMS.filter((term) => normalized.includes(normalize(term)));
}

export function decide(query, ranked, config) {
  const { min_coverage: minCoverage, min_margin: minMargin } = config.retrieval;

  const hits = sensitiveHits(query);
  if (hits.length > 0) {
    return {
      route: 'escalate',
      reason: `機微な語を含む（${hits.join('、')}）ため、自動回答しない`,
      hits,
    };
  }

  if (!ranked.top || ranked.top.score === 0) {
    return { route: 'refuse', reason: '手がかりになる語が一つも当たらない', hits };
  }

  if (ranked.coverage < minCoverage) {
    return {
      route: 'refuse',
      reason: `質問の語のうち当たったのが ${Math.round(ranked.coverage * 100)}%（下限 ${Math.round(minCoverage * 100)}%）`,
      hits,
    };
  }

  if (ranked.margin < minMargin) {
    return {
      route: 'escalate',
      reason: `一位と二位の差が ${Math.round(ranked.margin * 100)}%（下限 ${Math.round(minMargin * 100)}%）`,
      hits,
    };
  }

  return {
    route: 'answer',
    reason: `候補が一つに絞れた（当たり ${Math.round(ranked.coverage * 100)}%、差 ${Math.round(ranked.margin * 100)}%）`,
    hits,
  };
}

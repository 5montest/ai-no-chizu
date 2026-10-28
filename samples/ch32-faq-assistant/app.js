// app.js — 画面から engine.mjs を呼ぶだけ。判定の理屈は lib/ 側にある。

import { createEngine } from './lib/engine.mjs';

const ROUTE = {
  answer: { label: '答える', tone: 'answer' },
  escalate: { label: '人に回す', tone: 'escalate' },
  refuse: { label: '答えない', tone: 'refuse' },
};

const form = document.querySelector('#ask-form');
const input = document.querySelector('#query');
const resultBox = document.querySelector('#result');

let engine;
let titles = new Map();

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderEmpty() {
  resultBox.replaceChildren(el('p', 'result__empty', 'まだ質問していません。'));
}

function renderError(message) {
  resultBox.replaceChildren(el('p', 'result__empty', message));
}

function render(result) {
  const route = ROUTE[result.route];
  const wrap = el('div', 'result__body');

  const head = el('div', 'result__head');
  head.append(el('span', `badge badge--${route.tone}`, `${route.label}（${result.route}）`));
  head.append(el('span', 'result__reason', result.reason));
  wrap.append(head);

  const text = el('p', 'result__text', result.text);
  wrap.append(text);

  if (result.candidates.length > 0) {
    const details = el('details', 'result__more');
    details.append(el('summary', null, '候補と点数を見る'));

    const list = el('ol', 'cands');
    for (const candidate of result.candidates) {
      const item = el('li', 'cands__item');
      item.append(el('span', 'cands__id', candidate.id));
      item.append(el('span', 'cands__title', titles.get(candidate.id) ?? ''));
      item.append(el('span', 'cands__score', String(candidate.score)));
      list.append(item);
    }
    details.append(list);
    wrap.append(details);
  }

  const { inputTokens, outputTokens, cost, priced } = result.cost;
  const costLine = priced
    ? `推定費用 ${cost.toFixed(6)}（単価 × 推定トークン数）`
    : '推定費用 未設定（config.json に単価が入っていないため計算しません）';
  wrap.append(el('p', 'result__cost', `トークン推定 入力 ${inputTokens} / 出力 ${outputTokens}。${costLine}`));

  resultBox.replaceChildren(wrap);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!engine) return;
  const query = input.value.trim();
  if (query === '') {
    input.focus();
    renderError('質問を入力してください。');
    return;
  }
  render(engine.ask(query));
});

async function boot() {
  try {
    const [faqResponse, configResponse] = await Promise.all([
      fetch('./data/faq.json'),
      fetch('./config.json'),
    ]);
    if (!faqResponse.ok || !configResponse.ok) throw new Error('データを読めませんでした');
    const faq = await faqResponse.json();
    const config = await configResponse.json();

    titles = new Map(faq.entries.map((entry) => [entry.id, entry.title]));
    engine = createEngine({ entries: faq.entries, config });
    document.body.dataset.ready = 'true';
    renderEmpty();
  } catch (error) {
    renderError(
      `データを読み込めませんでした（${error.message}）。このページは http で開いてください。ファイルを直接開くと動きません。`,
    );
  }
}

boot();

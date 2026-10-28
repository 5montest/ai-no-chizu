#!/usr/bin/env node
// cli.mjs — 端末から FAQ アシスタントに質問する。ネットワークには一切出ない。
//
//   node cli.mjs "会議室を予約したい"   一回だけ聞く
//   node cli.mjs --json "プロジェクターが映らない"   結果を JSON で出す
//   node cli.mjs                      対話モード（空行か exit で終わる）

import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createEngine } from './lib/engine.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const [, , ...rawArgs] = process.argv;
const asJson = rawArgs.includes('--json');
const words = rawArgs.filter((arg) => arg !== '--json');

const data = JSON.parse(await readFile(join(HERE, 'data', 'faq.json'), 'utf8'));
const config = JSON.parse(await readFile(join(HERE, 'config.json'), 'utf8'));
const engine = createEngine({ entries: data.entries, config });

const ROUTE_LABEL = { answer: '答える', escalate: '人に回す', refuse: '答えない' };

function show(result) {
  const top = result.candidates[0];

  console.log('');
  console.log(`質問: ${result.query}`);
  console.log(`判定: ${ROUTE_LABEL[result.route]}（${result.route}）`);
  console.log(`理由: ${result.reason}`);
  if (top) {
    const rest = result.candidates.slice(1).map((c) => `${c.id}:${c.score}`).join('、');
    console.log(`候補: ${top.id}:${top.score}${rest ? `（次点 ${rest}）` : ''}`);
  }
  console.log('');
  console.log(result.text);
  console.log('');
  console.log(`トークン推定: 入力 ${result.cost.inputTokens} / 出力 ${result.cost.outputTokens}`);
  console.log(
    result.cost.priced
      ? `推定費用: ${result.cost.cost.toFixed(6)}（config.json の単価 × 推定トークン数）`
      : '推定費用: 未設定（config.json の単価が空のため計算しない）',
  );
}

function emit(result) {
  if (asJson) console.log(JSON.stringify(result, null, 2));
  else show(result);
}

if (words.length > 0) {
  emit(engine.ask(words.join(' ')));
} else {
  const { retrieval } = config;
  console.log(
    `FAQ ${engine.entries.length} 件。当たりの下限 ${Math.round(retrieval.min_coverage * 100)}%、` +
      `一位と二位の差の下限 ${Math.round(retrieval.min_margin * 100)}%。`,
  );
  console.log('質問を入力してください。空行か exit で終わります。');

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  for await (const line of rl) {
    const query = line.trim();
    if (query === '' || query === 'exit' || query === 'quit') break;
    emit(engine.ask(query));
  }
  rl.close();
}

import assert from 'node:assert/strict';
import test from 'node:test';
import { planMonthlyCell, tokenRateCell, usageChargeCell } from '../src/lib/compare-prices.ts';
import type { ZukanEntity, ZukanPricing } from '../src/lib/zukan-types';
import { buildPriceIndex } from '../src/lib/zukan.mjs';

const snapshot = { id:'prices', kind:'subscription', vendor:'Example', product:'Example', currency:'USD', tax:'excluded', unit:'per_month', fetched_at:'2026-10-30', source:{title:'Pricing',url:'https://example.com/pricing',publisher:'Example',kind:'official'},notes:[] };
const prices = (fields: object) => ({ snapshots:[{...snapshot,...fields}] } as unknown as ZukanPricing);

test('法人プランは月払いと年払いの両方に1席あたりの単位を残す', () => {
  const cell=planMonthlyCell('business',prices({plans:[{entity_id:'business',billing:{monthly_usd:25,annual_monthly_usd:20,seat_based:true,minimum_seats:2}}]}));
  assert.ok(cell);assert.match(cell.text,/\$25\.00.*1席あたり/);assert.match(cell.meta,/年払い \$20\.00.*1席あたり/);assert.match(cell.meta,/2席以上/);
});

test('確認済みの選択肢は金額を表示し、未確認なのはその選択肢だけにする', () => {
  const cell=planMonthlyCell('max',prices({plans:[{entity_id:'max',billing:{monthly_usd:null,monthly_usd_from:100},selection:[{label:'5x',monthly_usd:100},{label:'20x',monthly_usd:null}]}]}));
  assert.ok(cell);assert.match(cell.text,/5x \$100\.00/);assert.doesNotMatch(cell.text,/未確認/);assert.match(cell.meta,/20xの実額は未確認/);assert.doesNotMatch(cell.meta,/5x.*未確認/);
});

test('無料、見積もり、地域条件、記録なしを混同しない', () => {
  assert.match(planMonthlyCell('p',prices({plans:[{entity_id:'p',billing:{monthly_usd:0}}]}))!.text,/\$0\.00/);
  for(const [period,label] of [['quote','個別見積もり'],['regional','地域別'],['route','契約先・認証方法']])assert.ok(planMonthlyCell('p',prices({plans:[{entity_id:'p',billing:{monthly_usd:null,billing_period:period}}]}))!.text.includes(label));
  assert.equal(planMonthlyCell('missing',prices({plans:[]})),null);
});

test('専用モデルの料金は3項目目以降も表示し、単位・条件・未知の値を保つ', () => {
  const charges=[{label:'文字入力',unit:'100万文字トークン',price:.6},{label:'文字出力',unit:'100万文字トークン',price:2.4},{label:'音声入力',unit:'100万音声トークン',price:10},{label:'音声出力',unit:'100万音声トークン',price:null}].map(c=>({...c,entity_id:'audio',condition:'Standard。保存は別料金。'}));
  const cell=usageChargeCell({id:'audio',pricing_snapshot_ids:['prices']} as ZukanEntity,prices({charges}));
  assert.ok(cell);assert.match(cell.text,/音声入力 \$10\.00／100万音声トークン/);assert.match(cell.text,/音声出力 未確認／100万音声トークン/);assert.match(cell.text,/保存は別料金/);assert.doesNotMatch(cell.text,/ほか\d+項目/);
});

test('トークン料金の入力長などの条件を途中で切り落とさない', () => {
  const condition='通常の入力。ただし200,000トークンを超える場合は別料金。';
  const data=prices({kind:'token-price',unit:'per_1m_tokens',rates:[{entity_id:'m',model_name:'M',tiers:[{condition,input:2,output:10}]}]});
  const cell=tokenRateCell('m','input',buildPriceIndex({pricing:data}));assert.ok(cell);assert.ok(cell.meta.includes(condition));assert.match(cell.meta,/100万トークンあたり/);assert.match(cell.meta,/公式/);
});

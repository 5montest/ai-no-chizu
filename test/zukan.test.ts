import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPriceIndex,
  compareEntities,
  entityBadges,
  estimateTokenCost,
  filterEntities,
  formatUsd,
  freshnessState,
  groupByKind,
  normalizeQuery,
  entityMatchesQuery,
  planPriceLines,
  planSnapshotsFor,
  priceBucket,
  priceEntriesFor,
  toPublicEntity,
} from '../src/lib/zukan.mjs';

/**
 * AI図鑑の検索・比較・試算のテスト。
 *
 * ここで守るのは表示の見た目ではなく、次の3つの約束。
 * 未確認の値を0として扱わない、確認できていない単価で試算しない、
 * 料金の出所（公式か再販か）を混ぜない。
 */

const kinds = [
  { id: 'model', label: 'モデル' },
  { id: 'harness', label: 'ハーネス' },
  { id: 'app', label: 'アプリ' },
];

function entity(overrides = {}) {
  return {
    id: 'sample',
    slug: 'sample',
    display_name: 'Sample 1.0',
    aliases: [],
    vendor: 'Sample Inc.',
    kind: 'model',
    availability_status: 'available',
    verification_status: 'official',
    primary_use_cases: ['general-chat'],
    interfaces: ['api'],
    platforms: ['web'],
    cost_model: 'paid',
    model_ids: [],
    last_checked_at: '2026-10-28',
    ...overrides,
  };
}

test('検索語は全角・大文字・連続空白の違いを吸収する', () => {
  assert.equal(normalizeQuery('  ＣＬＡＵＤＥ   Fable '), 'claude fable');
});

test('複数の語はすべて含むときだけ一致する', () => {
  const target = entity({ display_name: 'Claude Fable 5.1', vendor: 'Anthropic' });
  assert.equal(entityMatchesQuery(target, 'fable'), true);
  assert.equal(entityMatchesQuery(target, 'anthropic fable'), true);
  assert.equal(entityMatchesQuery(target, 'fable openai'), false);
});

test('別名とモデルIDでも引ける', () => {
  const target = entity({
    aliases: ['ファブル'],
    model_ids: [{ provider: 'OpenRouter', id: 'anthropic/claude-fable-5.1' }],
  });
  assert.equal(entityMatchesQuery(target, 'ファブル'), true);
  assert.equal(entityMatchesQuery(target, 'claude-fable-5.1'), true);
});

test('空の検索語はすべてに一致する', () => {
  const list = [entity({ id: 'a' }), entity({ id: 'b', kind: 'harness' })];
  assert.equal(filterEntities(list, { q: '   ' }).length, 2);
});

test('絞り込みの条件はすべてANDで効く', () => {
  const list = [
    entity({ id: 'a', primary_use_cases: ['coding'], interfaces: ['cli'] }),
    entity({ id: 'b', primary_use_cases: ['coding'], interfaces: ['api'] }),
    entity({ id: 'c', primary_use_cases: ['research'], interfaces: ['cli'] }),
  ];
  assert.deepEqual(
    filterEntities(list, { useCase: 'coding' }).map((item) => item.id),
    ['a', 'b'],
  );
  assert.deepEqual(
    filterEntities(list, { useCase: 'coding', interfaceId: 'cli' }).map((item) => item.id),
    ['a'],
  );
});

test('無料・有料の絞り込みは cost_model だけを見る', () => {
  const list = [
    entity({ id: 'free', cost_model: 'free' }),
    entity({ id: 'paid', cost_model: 'paid' }),
    entity({ id: 'usage', cost_model: 'usage-based' }),
    entity({ id: 'mixed', cost_model: 'mixed' }),
    entity({ id: 'unknown', cost_model: 'unknown' }),
  ];
  assert.deepEqual(
    filterEntities(list, { price: 'free' }).map((item) => item.id),
    ['free'],
  );
  assert.deepEqual(
    filterEntities(list, { price: 'paid' }).map((item) => item.id),
    ['paid', 'usage', 'mixed'],
  );
  // 未確認は「無料」にも「有料」にも寄せない。
  assert.deepEqual(
    filterEntities(list, { price: 'unknown' }).map((item) => item.id),
    ['unknown'],
  );
});

test('分類は定義順に並び、空の分類は出さない', () => {
  const list = [
    entity({ id: 'x', kind: 'app' }),
    entity({ id: 'y', kind: 'model' }),
    entity({ id: 'z', kind: 'model' }),
  ];
  const grouped = groupByKind(list, kinds);
  assert.deepEqual(
    grouped.map((group) => [group.kind.id, group.entities.length]),
    [
      ['model', 2],
      ['app', 1],
    ],
  );
});

test('比較は指定順を守り、見つからないIDを別に返す', () => {
  const list = [entity({ id: 'a' }), entity({ id: 'b' })];
  const result = compareEntities(list, ['b', 'a', 'gone'], kinds);
  assert.deepEqual(
    result.selected.map((item) => item.id),
    ['b', 'a'],
  );
  assert.deepEqual(result.missing, ['gone']);
  assert.equal(result.sameKind, true);
  assert.equal(result.layerNote, null);
});

test('分類がまたがるときは順位づけではなく層の違いだと示す', () => {
  const list = [
    entity({ id: 'm', kind: 'model' }),
    entity({ id: 'h', kind: 'harness' }),
  ];
  const result = compareEntities(list, ['m', 'h'], kinds);
  assert.equal(result.sameKind, false);
  assert.match(result.layerNote ?? '', /モデル・ハーネス/);
  assert.match(result.layerNote ?? '', /優劣ではなく役割の違い/);
});

test('確認日の経過は目安の日数で判定し、読めない日付は unknown', () => {
  const now = new Date(Date.UTC(2026, 9, 28));
  assert.deepEqual(freshnessState('2026-10-28', now, 30), { state: 'fresh', ageDays: 0, limitDays: 30 });
  assert.equal(freshnessState('2026-09-28', now, 30).state, 'fresh');
  assert.equal(freshnessState('2026-09-27', now, 30).state, 'stale');
  // 日付が読めないときは「新しい」とも言わない。
  assert.deepEqual(freshnessState('2026-10', now, 30), { state: 'unknown', ageDays: null, limitDays: 30 });
  assert.equal(freshnessState(null, now, 30).state, 'unknown');
});

test('料金表は公式を先に、同じ区分なら取得日の新しい順に並ぶ', () => {
  const pricing = {
    snapshots: [
      {
        id: 'reseller',
        kind: 'token-price',
        vendor: 'Reseller',
        product: 'Reseller',
        currency: 'USD',
        unit: 'per_1m_tokens',
        fetched_at: '2026-10-27',
        source: { kind: 'reseller' },
        rates: [{ entity_id: 'm', model_name: 'M', tiers: [{ condition: 'standard', input: 9, output: 9 }] }],
      },
      {
        id: 'official',
        kind: 'token-price',
        vendor: 'Vendor',
        product: 'Vendor API',
        currency: 'USD',
        unit: 'per_1m_tokens',
        fetched_at: '2026-10-28',
        source: { kind: 'official' },
        rates: [{ entity_id: 'm', model_name: 'M', tiers: [{ condition: 'standard', input: 1, output: 2 }] }],
      },
    ],
  };
  const index = buildPriceIndex({ pricing });
  const entries = priceEntriesFor(index, 'm');
  assert.deepEqual(
    entries.map((entry) => entry.snapshot_id),
    ['official', 'reseller'],
  );
  // 公式と再販は同じ表に混ぜない。呼び出し側が source_kind で分けられる。
  assert.deepEqual(
    entries.map((entry) => entry.source_kind),
    ['official', 'reseller'],
  );
});

test('外部参照の料金は参照先から読み、図鑑側に複製しない', () => {
  const pricing = {
    snapshots: [
      {
        id: 'reseller',
        kind: 'token-price',
        vendor: 'Reseller',
        product: 'Reseller',
        currency: 'USD',
        unit: 'per_1m_tokens',
        fetched_at: '2026-10-27',
        source: { kind: 'reseller' },
        rates: [],
        external_ref: { path: 'data/model-comparison.json', id_field: 'source_id' },
      },
    ],
  };
  const modelComparison = {
    models: [{ id: 'm', name: 'M', pricing: { input: 3, output: 6 } }],
  };
  const index = buildPriceIndex({ pricing, modelComparison });
  const [entry] = priceEntriesFor(index, 'm');
  assert.equal(entry.derived_from, 'data/model-comparison.json');
  assert.equal(entry.tiers[0].input, 3);
  assert.equal(entry.tiers[0].output, 6);
  // 参照先に無い項目は 0 ではなく null。
  assert.equal(entry.tiers[0].cache_read, null);
});

test('試算は入力と出力の単価から100万トークン単位で計算する', () => {
  const result = estimateTokenCost({
    inputTokens: 1_000_000,
    outputTokens: 0,
    tier: { input: 10, output: 50 },
  });
  assert.equal(result.ok, true);
  assert.equal(result.usd, 10);

  const mixed = estimateTokenCost({
    inputTokens: 500_000,
    outputTokens: 200_000,
    tier: { input: 2, output: 10 },
  });
  assert.equal(mixed.ok, true);
  assert.equal(mixed.usd, 1 + 2);
});

test('単価が未確認なら試算せず、理由を返す', () => {
  const result = estimateTokenCost({
    inputTokens: 1_000_000,
    tier: { input: 10, output: null },
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /確認できていない/);
});

test('単価が0でも試算は成立する（未確認と無料を区別する）', () => {
  const result = estimateTokenCost({
    inputTokens: 1_000_000,
    tier: { input: 0, output: 0 },
  });
  assert.equal(result.ok, true);
  assert.equal(result.usd, 0);
});

test('数値でないトークン数と負の値は試算しない', () => {
  assert.equal(estimateTokenCost({ inputTokens: -1, tier: { input: 1, output: 1 } }).ok, false);
  assert.equal(estimateTokenCost({ inputTokens: Number.NaN, tier: { input: 1, output: 1 } }).ok, false);
  assert.equal(estimateTokenCost({ inputTokens: 1 }).ok, false);
});

test('金額の表示は小さい額の桁を落とさない', () => {
  assert.equal(formatUsd(0), '$0.00');
  assert.equal(formatUsd(1.5), '$1.50');
  assert.equal(formatUsd(0.0042), '$0.0042');
  assert.equal(formatUsd(null), '—');
  assert.equal(formatUsd(Number.NaN), '—');
});

test('料金の区分は cost_model から決め、未確認を無料に寄せない', () => {
  assert.equal(priceBucket({ cost_model: 'free' }), 'free');
  for (const model of ['paid', 'usage-based', 'mixed']) {
    assert.equal(priceBucket({ cost_model: model }), 'paid');
  }
  // 値が無い・未知の値のどちらも「料金未確認」に落とす。
  assert.equal(priceBucket({ cost_model: 'unknown' }), 'unknown');
  assert.equal(priceBucket({}), 'unknown');
});

test('状態バッジは提供状況を中立、確認漏れを警告の色にする', () => {
  // available と official は既定なので、バッジを出さない。
  assert.deepEqual(entityBadges(entity()), []);

  // 提供終了は「済んだ事実」で、注意を促す色にはしない。
  assert.deepEqual(entityBadges(entity({ availability_status: 'retired' })), [
    { text: '提供終了', tone: 'neutral' },
  ]);
  assert.deepEqual(entityBadges(entity({ availability_status: 'limited' })), [
    { text: '限定提供', tone: 'neutral' },
  ]);

  // 情報の状態が公式に確認できていない場合は警告の色。
  assert.deepEqual(entityBadges(entity({ verification_status: 'reseller-only' })), [
    { text: '再販情報のみ', tone: 'warn' },
  ]);

  // 両方あるときは提供状況が先。並びは一覧・詳細で同じ。
  assert.deepEqual(
    entityBadges(entity({ availability_status: 'preview', verification_status: 'partial' })),
    [
      { text: 'プレビュー', tone: 'neutral' },
      { text: '一部未確認', tone: 'warn' },
    ],
  );

  // 未知の状態値では、当て推量の文言を作らない。
  assert.deepEqual(entityBadges(entity({ availability_status: 'gone', verification_status: '?' })), []);
});

test('プラン型の料金はプラン表から拾い、公式を先に並べる', () => {
  const pricing = {
    snapshots: [
      {
        id: 'reseller-plans',
        vendor: 'Reseller',
        product: 'Reseller',
        currency: 'USD',
        unit: 'per_month',
        fetched_at: '2026-10-27',
        source: { kind: 'reseller' },
        plans: [{ entity_id: 'p', plan: 'Pro', billing: { monthly_usd: 30 } }],
      },
      {
        id: 'official-plans',
        vendor: 'Vendor',
        product: 'Vendor',
        currency: 'USD',
        unit: 'per_month',
        fetched_at: '2026-10-20',
        source: { kind: 'official' },
        tax: 'excluded',
        plans: [{ entity_id: 'p', plan: 'Pro', billing: { monthly_usd: 25 } }],
      },
      {
        id: 'other-product',
        vendor: 'Vendor',
        product: 'Vendor',
        currency: 'USD',
        unit: 'per_month',
        fetched_at: '2026-10-28',
        source: { kind: 'official' },
        plans: [{ entity_id: 'someone-else', plan: 'Pro', billing: { monthly_usd: 5 } }],
      },
    ],
  };
  const snapshots = planSnapshotsFor(pricing, 'p');
  // 対象の項目が入っていないスナップショットは返さない。
  assert.deepEqual(
    snapshots.map((snapshot) => snapshot.snapshot_id),
    ['official-plans', 'reseller-plans'],
  );
  assert.equal(snapshots[0].tax, 'excluded');
  // 税の扱いが書かれていない表は unknown のまま。税込と決めつけない。
  assert.equal(snapshots[1].tax, 'unknown');
  assert.deepEqual(planSnapshotsFor({ snapshots: [] }, 'p'), []);
  assert.deepEqual(planSnapshotsFor(null, 'p'), []);
});

test('プランの金額は確認できた範囲だけを書き、0円を未確認と書かない', () => {
  assert.deepEqual(planPriceLines({ billing: { monthly_usd: 20 } }), ['$20.00 / 月']);

  // 0 は「確認できた0円」。未確認の文言に置き換えない。
  assert.deepEqual(planPriceLines({ billing: { monthly_usd: 0 } }), ['$0.00 / 月']);

  assert.deepEqual(planPriceLines({ billing: { monthly_usd: null } }), ['月額は未確認']);
  assert.deepEqual(planPriceLines({}), ['月額は未確認']);

  // 下限しか分からない場合は、下限だと分かる形にする。
  assert.deepEqual(planPriceLines({ billing: { monthly_usd_from: 15 } }), [
    '月額 $15.00 から（下限の額のみ確認）',
  ]);

  assert.deepEqual(
    planPriceLines({
      billing: {
        monthly_usd: 20,
        annual_monthly_usd: 16,
        annual_upfront_usd: 192,
        seat_based: true,
        minimum_seats: 2,
      },
    }),
    ['$20.00 / 月', '年払いなら $16.00 / 月', '年払いは $192.00 を一括', '席単位の料金（2席以上）'],
  );

  assert.deepEqual(planPriceLines({ billing: { seat_based: true } }), [
    '月額は未確認',
    '席単位の料金（席数の条件は未確認）',
  ]);

  assert.deepEqual(
    planPriceLines({
      billing: { monthly_usd: 20 },
      seats: [
        { label: '管理者', monthly_usd: 30, annual_monthly_usd: null },
      ],
    }),
    ['$20.00 / 月', '管理者 席: $30.00 / 月、年払いは未確認'],
  );
});

test('公開用のエンティティに料金の数値を混ぜない', () => {
  const publicEntity = toPublicEntity(
    entity({ cost_model: 'mixed', pricing_snapshot_ids: ['official'] }),
    { kinds },
  );
  assert.equal(publicEntity.kind_label, 'モデル');
  assert.deepEqual(publicEntity.pricing_snapshot_ids, ['official']);
  assert.equal(publicEntity.pricing, null);
  assert.equal('rates' in publicEntity, false);
});

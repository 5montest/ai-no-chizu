/**
 * AI図鑑の検索・絞り込み・比較・価格試算。
 *
 * ページからもスクリプトからも呼べるよう、Astro に依存しない純粋な関数だけを置く。
 * 価格の扱いで守ることは2つ。確認できていない値を 0 として計算しないこと、
 * 公式価格と再販価格を同じ表に並べないこと。
 */

/** 図鑑が「できる／できない」を表すときの値。unknown と no を混同しない。 */
export const CAPABILITY_VALUES = ['yes', 'no', 'unknown', 'n/a'];

/** 再確認を促すまでの日数。事実の保証期限ではなく、このサイトの運用上の目安。 */
export const PRICE_REVIEW_DAYS = 30;
export const SPEC_REVIEW_DAYS = 90;

const nfkc = (value) => String(value ?? '').normalize('NFKC');

/**
 * 検索語の正規化。全角・半角、大文字・小文字、連続する空白の違いを吸収する。
 */
export function normalizeQuery(value) {
  return nfkc(value).toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * 1件のエンティティから検索対象の文字列を作る。
 *
 * 名前・別名・提供元という仕様の3項目に加えて、スラッグとモデルIDを入れる。
 * 「claude-fable-5.1」のような表記で引けるようにするため。
 */
export function entitySearchText(entity) {
  const parts = [
    entity.display_name,
    entity.slug,
    entity.id,
    entity.vendor,
    entity.notes,
    entity.summary,
    entity.description,
    ...(entity.strengths ?? []),
    ...(entity.primary_use_cases ?? []),
    ...(entity.aliases ?? []),
    ...(entity.model_ids ?? []).map((modelId) => modelId.id),
    ...(entity.model_ids ?? []).map((modelId) => modelId.provider),
  ];
  return normalizeQuery(parts.filter(Boolean).join(' '));
}

/**
 * 検索語が空なら常に真。空白区切りの語はすべて含むときだけ一致とする。
 */
export function entityMatchesQuery(entity, query) {
  const q = normalizeQuery(query);
  if (!q) return true;
  const text = entitySearchText(entity);
  return q.split(' ').every((token) => text.includes(token));
}

/**
 * cost_model は「その製品をどう課金するか」の記録で、無料かどうかの根拠になる。
 * 価格が未確認（pricing_snapshot_ids が空）のものを無料扱いしないよう、
 * 判定は cost_model だけを見る。
 *
 * 一覧の絞り込みと一覧ページの data 属性で同じ判定を使うため、外にも出している。
 */
export function priceBucket(entity) {
  switch (entity.cost_model) {
    case 'free':
      return 'free';
    case 'paid':
    case 'usage-based':
    case 'mixed':
      return 'paid';
    default:
      return 'unknown';
  }
}

/**
 * 一覧の絞り込み。条件はすべて AND。
 *
 * 返すのは渡された要素そのもの。呼び出し側の型を保つため、要素の型は
 * 呼び出し側から受け取る（T）。ここでは絞り込みに使う項目だけを読む。
 *
 * @template {{ kind: string, cost_model: string, primary_use_cases?: string[], interfaces?: string[] }} T
 * @param {T[]} entities
 * @param {{ q?: string, kind?: string, useCase?: string, interfaceId?: string, price?: string }} options
 * @returns {T[]}
 */
export function filterEntities(entities, options = {}) {
  const { q = '', kind = 'all', useCase = 'all', interfaceId = 'all', price = 'all' } = options;
  return entities.filter((entity) => {
    if (kind !== 'all' && entity.kind !== kind) return false;
    if (useCase !== 'all' && !(entity.primary_use_cases ?? []).includes(useCase)) return false;
    if (interfaceId !== 'all' && !(entity.interfaces ?? []).includes(interfaceId)) return false;
    if (price !== 'all' && priceBucket(entity) !== price) return false;
    return entityMatchesQuery(entity, q);
  });
}

/**
 * 分類の定義順に並べ替える。空の分類は返さない。
 *
 * 要素の型は呼び出し側から受け取り（T）、そのまま返す。
 * 表示側は絞り込んだ結果の項目を読むので、ここで object に広げない。
 *
 * @template {{ kind: string }} T
 * @param {T[]} entities
 * @param {Array<{ id: string, label: string, description?: string }>} kinds
 * @returns {Array<{ kind: { id: string, label: string, description?: string }, entities: T[] }>}
 */
export function groupByKind(entities, kinds) {
  return kinds
    .map((kind) => ({
      kind,
      entities: entities.filter((entity) => entity.kind === kind.id),
    }))
    .filter((group) => group.entities.length > 0);
}

/**
 * 提供状況の表示名。available は既定なので、バッジにしない。
 * 表に無い値は「表示しない」で扱うため、キーは文字列で受ける。
 *
 * @type {Record<string, string>}
 */
export const AVAILABILITY_LABELS = {
  limited: '限定提供',
  preview: 'プレビュー',
  retired: '提供終了',
  unverified: '提供状況 未確認',
};

/**
 * 情報の状態の表示名。official は既定なので、バッジにしない。
 *
 * @type {Record<string, string>}
 */
export const VERIFICATION_LABELS = {
  'reseller-only': '再販情報のみ',
  partial: '一部未確認',
  unverified: '未確認',
};

/**
 * 項目の状態バッジを、意味に合った色分けと一緒に返す。
 *
 * 提供終了や限定提供は「済んだ事実・確定した条件」なので、注意を促す色にはしない。
 * 警告の色を使うのは、情報の状態が公式に確認できていない場合だけ。
 * 一覧・詳細・比較で同じ判定になるよう、表示の規則はここに1つだけ置く。
 *
 * @param {object} entity
 * @returns {Array<{ text: string, tone: 'neutral'|'warn' }>}
 */
export function entityBadges(entity) {
  const badges = [];
  const availability = AVAILABILITY_LABELS[entity.availability_status];
  if (availability) badges.push({ text: availability, tone: 'neutral' });
  const verification = VERIFICATION_LABELS[entity.verification_status];
  if (verification) badges.push({ text: verification, tone: 'warn' });
  return badges;
}

/**
 * 比較対象を id の指定順に取り出す。
 *
 * 分類が異なる場合は「同じ土俵の比較ではない」ことを示す注記を返す。
 * これは性能の順位づけではなく、層の違いの説明に使う。
 */
export function compareEntities(entities, ids, kinds = []) {
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const selected = [];
  const missing = [];
  for (const id of ids) {
    const entity = byId.get(id);
    if (entity) selected.push(entity);
    else missing.push(id);
  }

  const kindIds = [...new Set(selected.map((entity) => entity.kind))];
  const labels = new Map(kinds.map((kind) => [kind.id, kind.label]));
  const sameKind = kindIds.length <= 1;

  let layerNote = null;
  if (!sameKind) {
    const names = kindIds.map((id) => labels.get(id) ?? id);
    layerNote =
      `選んだ項目は${names.join('・')}にまたがっています。` +
      '分類が違うものは同じ層の製品ではないため、優劣ではなく役割の違いとして並べています。';
  }

  return { selected, missing, kindIds, sameKind, layerNote };
}

/**
 * 確認日からの経過を見る。
 *
 * 「古い」は事実が誤りという意味ではなく、このサイトの目安を過ぎたという意味。
 * 日付が読めないときは unknown を返し、新しいとも古いとも言わない。
 *
 * @returns {{ state: 'fresh'|'stale'|'unknown', ageDays: number|null, limitDays: number }}
 */
export function freshnessState(checkedAt, now, limitDays) {
  const checked = parseDate(checkedAt);
  const today = now instanceof Date ? now : parseDate(now);
  if (!checked || !today) return { state: 'unknown', ageDays: null, limitDays };
  const ageDays = Math.floor((today.getTime() - checked.getTime()) / 86_400_000);
  return { state: ageDays > limitDays ? 'stale' : 'fresh', ageDays, limitDays };
}

function parseDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * 単価の1段階。条件（standard など）と、100万トークンあたりの単価。
 * 確認できていない欄は null で持ち、0 とは区別する。
 *
 * @typedef {object} PriceTierRow
 * @property {string} condition
 * @property {number | null} input
 * @property {number | null} output
 * @property {number | null} cache_read
 * @property {number | null} cache_write
 */

/**
 * 料金表の1行。スナップショットの見出しと、1モデル分の単価をまとめたもの。
 *
 * @typedef {object} PriceEntry
 * @property {string} snapshot_id
 * @property {string} snapshot_kind
 * @property {string} vendor
 * @property {string} product
 * @property {string} currency
 * @property {string} unit
 * @property {string} tax
 * @property {string} fetched_at
 * @property {{ title?: string, url?: string, publisher?: string, kind?: string } | null} source
 * @property {string} source_kind
 * @property {string[] | null} snapshot_notes
 * @property {string | null} entity_id
 * @property {string} model_name
 * @property {PriceTierRow[]} tiers
 * @property {number | null} monthly_limit_usd
 * @property {string | null} derived_from
 */

/**
 * 価格スナップショットと既存のモデル比較データを、モデル単位の料金表にほどく。
 *
 * 再販価格（external_ref）は model-comparison.json を唯一の出所として読み、
 * この図鑑側には複製しない。同じ数値が2か所にあると、片方だけ直して食い違う。
 *
 * @param {{ pricing: object, modelComparison?: object }} data
 * @returns {{ entries: PriceEntry[], byEntity: Map<string, PriceEntry[]> }}
 */
export function buildPriceIndex({ pricing, modelComparison } = {}) {
  const entries = [];
  const snapshots = pricing?.snapshots ?? [];

  for (const snapshot of snapshots) {
    const base = {
      snapshot_id: snapshot.id,
      snapshot_kind: snapshot.kind,
      vendor: snapshot.vendor,
      product: snapshot.product,
      currency: snapshot.currency,
      unit: snapshot.unit,
      // 税の扱いと注記は、金額と同じ行に出す。額だけ見せると総額と読み違えられる。
      tax: snapshot.tax ?? 'unknown',
      fetched_at: snapshot.fetched_at,
      source: snapshot.source,
      source_kind: snapshot.source?.kind ?? 'unknown',
      snapshot_notes: snapshot.notes ?? null,
    };

    for (const rate of snapshot.rates ?? []) {
      entries.push({
        ...base,
        entity_id: rate.entity_id,
        model_name: rate.model_name,
        tiers: rate.tiers ?? [],
        monthly_limit_usd: null,
        derived_from: null,
      });
    }

    for (const limit of snapshot.model_limits ?? []) {
      entries.push({
        ...base,
        entity_id: limit.entity_id ?? null,
        model_name: limit.model_name,
        tiers: limit.tiers ?? [],
        monthly_limit_usd: limit.monthly_limit_usd ?? null,
        derived_from: null,
      });
    }

    const ref = snapshot.external_ref;
    if (ref && (snapshot.rates ?? []).length === 0 && modelComparison) {
      for (const model of modelComparison.models ?? []) {
        entries.push({
          ...base,
          entity_id: model.id,
          model_name: model.name,
          monthly_limit_usd: null,
          derived_from: ref.path,
          tiers: [
            {
              condition: '再販の提示価格（条件の記載なし）',
              input: model.pricing?.input ?? null,
              output: model.pricing?.output ?? null,
              cache_read: null,
              cache_write: null,
            },
          ],
        });
      }
    }
  }

  const weight = (entry) => (entry.source_kind === 'official' ? 0 : 1);
  entries.sort((a, b) => {
    if (a.entity_id !== b.entity_id) return String(a.entity_id).localeCompare(String(b.entity_id));
    if (weight(a) !== weight(b)) return weight(a) - weight(b);
    return String(b.fetched_at).localeCompare(String(a.fetched_at));
  });

  const byEntity = new Map();
  for (const entry of entries) {
    if (!entry.entity_id) continue;
    if (!byEntity.has(entry.entity_id)) byEntity.set(entry.entity_id, []);
    byEntity.get(entry.entity_id).push(entry);
  }

  return { entries, byEntity };
}

/**
 * そのエンティティの料金表。公式を先に、同じ区分なら取得日の新しい順。
 *
 * @param {{ byEntity?: Map<string, PriceEntry[]> } | null | undefined} index
 * @param {string} entityId
 * @returns {PriceEntry[]}
 */
export function priceEntriesFor(index, entityId) {
  return index?.byEntity?.get(entityId) ?? [];
}

/**
 * 席ごとの料金。
 *
 * @typedef {object} PlanSeat
 * @property {string} label
 * @property {number|null} [monthly_usd]
 * @property {number|null} [annual_monthly_usd]
 */

/**
 * 追加オプションの料金。
 *
 * @typedef {object} PlanOption
 * @property {string} label
 * @property {number|null} [monthly_usd]
 * @property {string} [note]
 */

/**
 * プラン1件。表示に使うのは名前と料金だけ。金額の文章化は planPriceLines() が担う。
 *
 * @typedef {object} PlanRecord
 * @property {string} plan_id
 * @property {string} entity_id
 * @property {string} display_name
 * @property {string} audience
 * @property {object} [billing]
 * @property {Array<PlanSeat>} [seats]
 * @property {Array<PlanOption>} [selection]
 * @property {Array<string>} [notes]
 * @property {number|null} [monthly_usd]
 */

/**
 * プラン型スナップショット1件分。見出しと、その製品に該当するプランだけを持つ。
 *
 * @typedef {object} PlanSnapshot
 * @property {string} snapshot_id
 * @property {string} vendor
 * @property {string} product
 * @property {string} currency
 * @property {string} tax
 * @property {string} unit
 * @property {string} fetched_at
 * @property {{ title?: string, url?: string, publisher?: string, kind?: string } | null} source
 * @property {string} source_kind
 * @property {string[]} notes
 * @property {PlanRecord[]} plans
 */

/**
 * プラン型（月額・席単位）の料金を、スナップショットごとにまとめて取り出す。
 *
 * 料金スナップショットには単価表（rates）とプラン表（plans）の2つの形があり、
 * プランは rates に現れない。ここを取りこぼすと、プランだけの製品が「料金なし」に見える。
 *
 * @param {object | null | undefined} pricing
 * @param {string} entityId
 * @returns {PlanSnapshot[]}
 */
export function planSnapshotsFor(pricing, entityId) {
  const out = [];
  for (const snapshot of pricing?.snapshots ?? []) {
    const plans = (snapshot.plans ?? []).filter((plan) => plan.entity_id === entityId);
    if (plans.length === 0) continue;
    out.push({
      snapshot_id: snapshot.id,
      vendor: snapshot.vendor,
      product: snapshot.product,
      currency: snapshot.currency,
      tax: snapshot.tax ?? 'unknown',
      unit: snapshot.unit,
      fetched_at: snapshot.fetched_at,
      source: snapshot.source ?? null,
      source_kind: snapshot.source?.kind ?? 'unknown',
      notes: snapshot.notes ?? [],
      plans,
    });
  }
  const weight = (snapshot) => (snapshot.source_kind === 'official' ? 0 : 1);
  out.sort(
    (a, b) => weight(a) - weight(b) || String(b.fetched_at).localeCompare(String(a.fetched_at)),
  );
  return out;
}

/**
 * プラン1件の金額を、確認できた範囲だけで文章にする。
 *
 * 額が null のときは「未確認」と書き、0 とは書かない。
 * 下限だけ分かっている場合（monthly_usd_from）は、下限だと分かる形で出す。
 */
export function planPriceLines(plan) {
  const lines = [];
  const billing = plan?.billing ?? {};

  if (billing.monthly_usd !== null && billing.monthly_usd !== undefined) {
    lines.push(`${formatUsd(billing.monthly_usd)} / 月`);
  } else if (billing.monthly_usd_from !== null && billing.monthly_usd_from !== undefined) {
    lines.push(`月額 ${formatUsd(billing.monthly_usd_from)} から（下限の額のみ確認）`);
  } else if (plan?.monthly_usd !== null && plan?.monthly_usd !== undefined) {
    lines.push(`${formatUsd(plan.monthly_usd)} / 月`);
  } else {
    const condition = { quote: '個別見積もり（営業窓口へ確認）', regional: '地域別の申込画面で料金を確認', route: '認証方法・契約先で料金を確認' };
    lines.push(condition[billing.billing_period] ?? '月額は未確認');
  }

  if (billing.annual_monthly_usd !== null && billing.annual_monthly_usd !== undefined) {
    lines.push(`年払いなら ${formatUsd(billing.annual_monthly_usd)} / 月`);
  }
  if (billing.annual_upfront_usd !== null && billing.annual_upfront_usd !== undefined) {
    lines.push(`年払いは ${formatUsd(billing.annual_upfront_usd)} を一括`);
  }
  if (billing.seat_based) {
    const from = billing.minimum_seats;
    const to = billing.maximum_seats;
    if (from === null || from === undefined) lines.push('席単位の料金（席数の条件は未確認）');
    else if (to === null || to === undefined) lines.push(`席単位の料金（${from}席以上）`);
    else lines.push(`席単位の料金（${from}〜${to}席）`);
  }

  for (const seat of plan.seats ?? []) {
    const monthly =
      seat.monthly_usd === null || seat.monthly_usd === undefined
        ? '月払いは未確認'
        : `${formatUsd(seat.monthly_usd)} / 月`;
    const annual =
      seat.annual_monthly_usd === null || seat.annual_monthly_usd === undefined
        ? '年払いは未確認'
        : `${formatUsd(seat.annual_monthly_usd)} / 月（年払い）`;
    lines.push(`${seat.label} 席: ${monthly}、${annual}`);
  }

  for (const option of plan.selection ?? []) {
    const amount =
      option.monthly_usd === null || option.monthly_usd === undefined
        ? '月額は未確認'
        : `${formatUsd(option.monthly_usd)} / 月`;
    lines.push(`${option.label}: ${amount}${option.note ? `（${option.note}）` : ''}`);
  }

  return lines;
}

/**
 * 100万トークンあたりの単価から、1回の実行費用を試算する。
 *
 * 入力か出力の単価が null のときは試算しない。0 として足すと、
 * 未確認の項目が「無料」に見えてしまう。
 *
 * tier は省略できる。区分が選ばれていない呼び出しも、実行時に
 * 「料金区分が選ばれていません。」として弾く対象だから。
 *
 * @param {{ inputTokens: number, outputTokens?: number, tier?: { input: number|null, output: number|null } }} args
 * @returns {{ ok: true, usd: number } | { ok: false, reason: string }}
 */
export function estimateTokenCost({ inputTokens, outputTokens = 0, tier } = {}) {
  if (!tier) return { ok: false, reason: '料金区分が選ばれていません。' };
  if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens)) {
    return { ok: false, reason: 'トークン数が数値ではありません。' };
  }
  if (inputTokens < 0 || outputTokens < 0) {
    return { ok: false, reason: 'トークン数が負の値です。' };
  }
  if (tier.input === null || tier.input === undefined || tier.output === null || tier.output === undefined) {
    return { ok: false, reason: 'この区分の単価が確認できていないため、試算できません。' };
  }
  const usd = (inputTokens / 1_000_000) * tier.input + (outputTokens / 1_000_000) * tier.output;
  return { ok: true, usd };
}

/**
 * 米ドルの表示。ごく小さい額は桁を落とさないよう小数点以下4桁まで出す。
 */
export function formatUsd(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  if (value !== 0 && Math.abs(value) < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

/**
 * 図鑑と既存データの食い違いを探す。
 *
 * 同じ事実を2か所に書くと、片方だけ更新されてサイト内で矛盾する。
 * 価格は再販分を model-comparison.json だけに置いているので、
 * ここでは値ではなく ID・文脈長・入力モダリティの一致だけを見る。
 *
 * @param {{ zukan: object, comparison: object, capabilities?: object }} data
 * @returns {string[]} 見つかった食い違い。空なら整合している。
 */
export function findModelMismatches({ zukan, comparison, capabilities } = {}) {
  const mismatches = [];
  const entities = zukan?.entities ?? [];
  const byId = new Map(entities.map((entity) => [entity.id, entity]));

  for (const model of comparison?.models ?? []) {
    const entity = byId.get(model.id);
    if (!entity) {
      mismatches.push(
        `model-comparison.json の ${model.id} に対応する図鑑エンティティがありません`,
      );
      continue;
    }

    const resellerId = (entity.model_ids ?? []).find((modelId) => modelId.provider === 'OpenRouter');
    if (resellerId?.id !== model.source_id) {
      mismatches.push(
        `zukan.json: ${entity.id} の OpenRouter ID が model-comparison.json と一致しません` +
          `（${resellerId?.id ?? '未登録'} / ${model.source_id}）`,
      );
    }

    if (entity.context_window?.basis === 'reseller' && entity.context_window.tokens !== model.context) {
      mismatches.push(
        `zukan.json: ${entity.id} の文脈長が model-comparison.json と一致しません` +
          `（${entity.context_window.tokens} / ${model.context}）`,
      );
    }
  }

  // 図鑑にしかないモデル（公式のみ確認）は比較表に無くてよい。逆は許さない。
  const modalityAxis = (capabilities?.axes ?? []).find((axis) => axis.id === 'input-modalities');
  for (const value of modalityAxis?.values ?? []) {
    const entity = entities.find((item) =>
      (item.model_ids ?? []).some((modelId) => modelId.id === value.model_id),
    );
    if (!entity || !Array.isArray(entity.input_modalities)) continue;
    // 公式と再販では入力の受け渡し方が異なり得る。同じ提供経路だけを突き合わせる。
    if (entity.input_modalities_basis === 'official' && value.source?.kind !== 'official') continue;
    const expected = [...(value.value?.input ?? [])].sort().join(',');
    const actual = [...entity.input_modalities].sort().join(',');
    if (expected !== actual) {
      mismatches.push(
        `zukan.json: ${entity.id} の入力モダリティが capability-snapshots.json と一致しません` +
          `（${actual} / ${expected}）`,
      );
    }
  }

  return mismatches;
}

/**
 * 図鑑のエンティティを、検索用の JSON に落とす。
 * 料金は別スナップショットを参照するだけで、ここに数値を混ぜない。
 *
 * @param {object} entity
 * @param {{ kinds?: Array<{ id: string, label: string }>, pricing?: object | null }} [options]
 */
export function toPublicEntity(entity, { kinds = [], pricing = null } = {}) {
  const kind = kinds.find((item) => item.id === entity.kind);
  return {
    id: entity.id,
    slug: entity.slug,
    display_name: entity.display_name,
    aliases: entity.aliases ?? [],
    vendor: entity.vendor,
    kind: entity.kind,
    kind_label: kind?.label ?? entity.kind,
    subtype: entity.subtype ?? null,
    availability_status: entity.availability_status,
    verification_status: entity.verification_status,
    primary_use_cases: entity.primary_use_cases ?? [],
    interfaces: entity.interfaces ?? [],
    platforms: entity.platforms ?? [],
    cost_model: entity.cost_model,
    last_checked_at: entity.last_checked_at,
    notes: entity.notes,
    summary: entity.summary ?? null,
    description: entity.description ?? null,
    pricing_snapshot_ids: entity.pricing_snapshot_ids ?? [],
    pricing,
  };
}

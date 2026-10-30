import { buildPriceIndex, formatUsd, planSnapshotsFor, priceEntriesFor } from './zukan.mjs';
import type { ZukanPricing, ZukanEntity } from './zukan-types';

const TAX_LABELS: Record<string, string> = {
  excluded: '税別',
  included: '税込',
  unknown: '税の扱い未確認',
};
const UNIT_LABELS: Record<string, string> = {
  per_month: '月額',
  per_1m_tokens: '100万トークンあたり',
  per_request: '1リクエストあたり',
};
const SOURCE_KIND_LABELS: Record<string, string> = {
  official: '公式',
  reseller: '再販',
};

/**
 * 比較表の金額セル。
 *
 * 各金額に単位を添える。月額・トークン単価・用途ごとの従量単価は行を分け、
 * 単位・税の扱い・取得日・公式/再販の区分をセルの中（meta）に添える。
 * 金額が記録されていない場合は null を返し、呼び出し側が「未記録」か「対象外」を決める。
 */
export type PriceCell = { text: string; meta: string };

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** 料金スナップショットの出所・取得日・税。金額と同じセルに添える共通の接尾辞。 */
const priceMeta = (snapshot: { tax?: string; fetched_at?: string; source_kind?: string }): string =>
  `${TAX_LABELS[snapshot.tax ?? 'unknown'] ?? '税の扱い未確認'}・取得 ${snapshot.fetched_at ?? '未記録'}・${
    SOURCE_KIND_LABELS[snapshot.source_kind ?? ''] ?? '出所未確認'
  }`;

/** プランの月額。金額が無いときも、見積もり・地域別などの条件を書いて「0円」と読ませない。 */
export const planMonthlyCell = (entityId: string, pricing: ZukanPricing): PriceCell | null => {
  const snapshots = planSnapshotsFor(pricing, entityId);
  const snapshot = snapshots[0];
  const plan = snapshot?.plans?.[0];
  if (!snapshot || !plan) return null;

  // プラン表は billing の下に月額・席条件を持つ形と、プラン直下に月額を持つ形がある。
  // 表示に使う欄だけをローカルに型付けし、記録に無い欄は null のまま扱う。
  type PlanView = {
    monthly_usd?: number | null;
    billing?: Record<string, unknown>;
    seats?: Array<{
      label: string;
      monthly_usd?: number | null;
      annual_monthly_usd?: number | null;
    }>;
    selection?: Array<{ label?: string; monthly_usd?: number | null }>;
    limits?: Record<string, unknown>;
  };
  const view = plan as unknown as PlanView;
  const billing = view.billing ?? {};
  const seats = view.seats ?? [];
  const limits = view.limits ?? {};
  const monthly = isNumber(billing.monthly_usd)
    ? formatUsd(billing.monthly_usd)
    : isNumber(view.monthly_usd)
      ? formatUsd(view.monthly_usd)
      : null;
  const monthlyFrom = isNumber(billing.monthly_usd_from) ? formatUsd(billing.monthly_usd_from) : null;
  const annualMonthly = isNumber(billing.annual_monthly_usd) ? formatUsd(billing.annual_monthly_usd) : null;
  const annualUpfront = isNumber(billing.annual_upfront_usd) ? formatUsd(billing.annual_upfront_usd) : null;
  const minSeats = isNumber(billing.minimum_seats) ? billing.minimum_seats : null;
  const maxSeats = isNumber(billing.maximum_seats) ? billing.maximum_seats : null;
  const firstSeat = seats[0];
  const firstSeatMonthly = isNumber(firstSeat?.monthly_usd) ? formatUsd(firstSeat.monthly_usd) : null;

  const selections = view.selection ?? [];
  const pricedSelections = selections.filter(item => isNumber(item.monthly_usd));
  const seatUnit = billing.seat_based ? '（1席あたり）' : '';

  let text: string;
  if (monthly) text = `${monthly}／月${seatUnit}`;
  else if (pricedSelections.length > 0) text = pricedSelections.map(item => `${item.label ?? '選択肢'} ${formatUsd(item.monthly_usd)}／月`).join('、');
  else if (monthlyFrom) text = `${monthlyFrom}〜／月${seatUnit}（下限のみ確認）`;
  else if (annualMonthly && billing.billing_period === 'year' && billing.seat_based) {
    text = `年払い ${annualMonthly}／月（1席あたり）`;
  } else if (firstSeat && firstSeatMonthly) text = `${firstSeat.label} ${firstSeatMonthly}／月（1席あたり）`;
  else if (billing.billing_period === 'quote') text = '個別見積もり（営業窓口）';
  else if (billing.billing_period === 'regional') text = '地域別（申込画面で確認）';
  else if (billing.billing_period === 'route') text = '契約先・認証方法で確認';
  else text = '未確認（詳細ページに条件）';

  const meta: string[] = [];
  if (monthly && annualMonthly) {
    meta.push(annualUpfront ? `年払い ${annualMonthly}／月（${annualUpfront} を一括）` : `年払い ${annualMonthly}／月${seatUnit}`);
  } else if (annualUpfront) {
    meta.push(`${annualUpfront} を一括`);
  }
  if (firstSeat && !monthly && isNumber(firstSeat.annual_monthly_usd)) {
    meta.push(`年払い ${formatUsd(firstSeat.annual_monthly_usd)}／月`);
  }
  const otherSeats = seats.slice(1).filter((seat) => isNumber(seat.monthly_usd));
  if (otherSeats.length > 0) {
    meta.push(
      otherSeats
        .map((seat) => `${seat.label}席 ${formatUsd(seat.monthly_usd as number)}／月`)
        .join('、'),
    );
  }
  if (minSeats !== null && maxSeats !== null) meta.push(`${minSeats}〜${maxSeats}席`);
  else if (minSeats !== null) meta.push(`${minSeats}席以上`);
  const unpricedSelections = selections.filter(item => !isNumber(item.monthly_usd));
  if (unpricedSelections.length > 0) {
    meta.push(`${unpricedSelections.map(item => item.label ?? '選択肢').join('・')}の実額は未確認`);
  }
  if (limits.usage_billed_at === 'API rates') meta.push('利用量はAPI単価で別に課金');
  meta.push(priceMeta({ tax: snapshot.tax, fetched_at: snapshot.fetched_at, source_kind: snapshot.source_kind }));

  return { text, meta: meta.join('・') };
};

/** 従量のトークン単価。公式を先に読み、条件（standard など）も同じセルに添える。 */
export const tokenRateCell = (entityId: string, side: 'input' | 'output', priceIndex: ReturnType<typeof buildPriceIndex>): PriceCell | null => {
  const entries = priceEntriesFor(priceIndex, entityId);
  const entry = entries[0];
  if (!entry || entry.tiers.length === 0) return null;
  const tier = entry.tiers.find((item) => item.condition === 'standard') ?? entry.tiers[0];
  const value = side === 'input' ? tier.input : tier.output;
  const meta: string[] = [tier.condition];
  if (entry.tiers.length > 1) meta.push(`ほか${entry.tiers.length - 1}区分`);
  meta.push(UNIT_LABELS[entry.unit] ?? entry.unit);
  meta.push(priceMeta({ tax: entry.tax, fetched_at: entry.fetched_at, source_kind: entry.source_kind }));
  return { text: isNumber(value) ? formatUsd(value) : '未確認', meta: meta.join('・') };
};

/** 音声の分・画像の枚数など、用途ごとの従量単価。単位はセルの中に書く。 */
export const usageChargeCell = (entity: ZukanEntity, pricing: ZukanPricing): PriceCell | null => {
  const snapshot = pricing.snapshots.find(
    (item) => entity.pricing_snapshot_ids.includes(item.id) && (item.charges ?? []).some((charge) => charge.entity_id === entity.id),
  );
  if (!snapshot) return null;
  const charges = (snapshot.charges ?? []).filter((charge) => charge.entity_id === entity.id);
  if (charges.length === 0) return null;
  const listed = charges.map(charge => `${charge.label} ${isNumber(charge.price) ? formatUsd(charge.price) : '未確認'}／${charge.unit}（${charge.condition}）`);
  return {
    text: listed.join('\n'),
    meta: priceMeta({ tax: snapshot.tax, fetched_at: snapshot.fetched_at, source_kind: snapshot.source?.kind }),
  };
};


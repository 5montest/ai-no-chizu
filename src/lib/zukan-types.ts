/**
 * AI図鑑（data/zukan.json・data/zukan-pricing.json）の型。
 *
 * JSON をそのまま import すると、項目ごとに揃っていない値（null・未登録・
 * 配列の有無）が union として広がり、表示側のどこでも型が緩む。
 * 図鑑の約束は「確認できた値だけを表示し、未確認は unknown か null」なので、
 * その約束を型として一箇所に書き、ページ側はこの型に寄せる。
 *
 * 値そのものの検査は scripts/validate-zukan.mjs が受け持つ。
 * ここは表示に必要な形だけを定義し、値の正しさは保証しない。
 */

export const CAPABILITY = ['yes', 'no', 'unknown', 'n/a'] as const;
export type Capability = (typeof CAPABILITY)[number];

export type CostModel = 'free' | 'paid' | 'usage-based' | 'mixed' | 'unknown';

export type AvailabilityStatus = 'available' | 'limited' | 'preview' | 'retired' | 'unverified';

export type VerificationStatus = 'official' | 'reseller-only' | 'partial' | 'unverified';

export type Environment = 'api-official' | 'api-reseller';

export type ModelVerificationStatus = 'official' | 'reseller-only' | 'partial' | 'unverified';

/** 分類・用途・接続方法などの語彙。id と表示名の組。 */
export interface ZukanTerm {
  id: string;
  label: string;
  description?: string;
}

/** モデルIDは、提供元と環境を添えて保持する。同じ名前でも環境が違えば別物になる。 */
export interface ZukanModelId {
  provider: string;
  id: string;
  environment: Environment;
  verification_status: ModelVerificationStatus;
  verified_at: string;
  note?: string;
}

export interface ZukanSource {
  title: string;
  url?: string;
  publisher?: string;
  note?: string;
}

/** 文脈長はトークン数だけでなく、数え方（basis）を添える。 */
export interface ZukanContextWindow {
  tokens: number;
  basis: string;
  note?: string;
}

export interface ZukanReasoningEfforts {
  supported: string[];
  default: string;
  mandatory: boolean;
}

export interface ZukanEntity {
  id: string;
  slug: string;
  display_name: string;
  aliases: string[];
  vendor: string;
  kind: string;
  subtype: string;
  availability_status: AvailabilityStatus;
  verification_status: VerificationStatus;
  primary_use_cases: string[];
  not_suitable_for: string[];
  strengths: string[];
  limitations: string[];
  interfaces: string[];
  platforms: string[];
  requires: string[];
  available_via: string[];
  model_ids: ZukanModelId[];
  input_modalities: string[] | null;
  input_modalities_basis?: 'official' | 'reseller';
  output_modalities: string[] | null;
  context_window: ZukanContextWindow | null;
  context_label?: string;
  reasoning_efforts: ZukanReasoningEfforts | null;
  tool_support: Capability;
  skills: Capability;
  plugins: Capability;
  mcp: Capability;
  subagents: Capability;
  plan_mode: Capability;
  permissions: Capability;
  capability_notes: string;
  cost_model: CostModel;
  pricing_snapshot_ids: string[];
  official_url: string;
  sources: ZukanSource[];
  last_verified_at: string;
  last_checked_at: string;
  notes: string;
  /** 一覧カードと検索に使う40字程度の要約。「何か／どんな用途に向くか」を書く。 */
  summary?: string;
  /** 「これは何か」に出す製品説明。notes が確認メモ（出典・条件）の項目だけに持つ。 */
  description?: string;
  conditions: string[];
}

/** 提供終了・改名した項目。削除せず、ここに残す。 */
export interface ZukanHistoryEntry {
  id: string;
  status: string;
  entity_id: string;
  checked_at: string;
  note: string;
  source?: ZukanSource;
}

export interface ZukanPolicy {
  display_rule: string;
  price_separation: string;
  freshness: {
    price_review_after_days: number;
    spec_review_after_days: number;
    display_rule: string;
    note: string;
  };
  retired_rule: string;
  source_rule: string;
  measurement_rule: string;
}

export interface Zukan {
  schema_version: string;
  updated_at: string;
  policy: ZukanPolicy;
  kinds: ZukanTerm[];
  use_cases: ZukanTerm[];
  interfaces: ZukanTerm[];
  platforms: ZukanTerm[];
  access_routes: ZukanTerm[];
  entities: ZukanEntity[];
  plan_matrix: Record<string, unknown>;
  history: ZukanHistoryEntry[];
}

/** 料金の1段階。未確認は null で持ち、0 とは区別する。 */
export interface PriceTier {
  condition: string;
  input: number | null;
  output: number | null;
  cache_read: number | null;
  cache_write: number | null;
}

export interface PriceRate {
  entity_id: string;
  model_name: string;
  tiers: PriceTier[];
}

export interface PlanBilling {
  monthly_usd: number | null;
  annual_monthly_usd: number | null;
  annual_upfront_usd: number | null;
  billing_period: string;
}

export interface PlanRecord {
  plan_id: string;
  entity_id: string;
  display_name: string;
  audience: string;
  billing?: PlanBilling;
  limits?: Record<string, unknown>;
  notes?: string[];
  monthly_usd?: number | null;
}

export interface PriceSnapshot {
  id: string;
  kind: string;
  vendor: string;
  product: string;
  currency: string;
  tax: string;
  unit: string;
  fetched_at: string;
  source: ZukanSource & { kind?: string };
  notes: string[];
  plans?: PlanRecord[];
  rates?: PriceRate[];
  charges?: Array<{ entity_id: string; label: string; unit: string; price: number | null; condition: string; source: ZukanSource }>;
  quota_policy?: Record<string, unknown>;
  model_limits?: unknown[];
  /** 再販価格を別ファイルから読む場合の参照先。図鑑側には複製しない。 */
  external_ref?: { path: string; id_field?: string; note?: string };
}

export interface ZukanPricing {
  schema_version: string;
  updated_at: string;
  policy: Record<string, unknown>;
  snapshots: PriceSnapshot[];
}

/** data/model-comparison.json の1モデル。図鑑との突き合わせに使う最小限。 */
export interface ComparisonModel {
  id: string;
  name: string;
  vendor: string;
  model_ids?: string[];
  [key: string]: unknown;
}

export interface ModelComparison {
  schema_version?: string;
  updated_at?: string;
  models: ComparisonModel[];
  [key: string]: unknown;
}

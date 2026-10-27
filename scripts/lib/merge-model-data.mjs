/**
 * API の応答と公開データを突き合わせる処理。
 *
 * 取得スクリプトから切り離してあるのは、ネットワークなしで検証できるようにするため。
 * 方針は「分からないものは消さない・決めない」。
 *   - API に無いモデルは、公開済みの値をそのまま残す
 *   - 重みの公開可否は API から決められないので、新しいモデルは未確認（null）で入れる
 *   - 条件付き料金は API に無いので null のまま（人が確認した値だけ引き継ぐ）
 */

export const PRICING_SOURCE = {
  name: 'OpenRouter Models API',
  kind: 'reseller',
  url: 'https://openrouter.ai/api/v1/models',
  note: '料金は OpenRouter 経由の単価で、各社が公式 API で公開している単価とは一致しない場合がある。公式価格は各社の料金ページで確認すること。',
};

export function toPerMillion(value) {
  // 空文字や null は Number() が 0 になる。0 円と「値が無い」を取り違えないよう先に弾く。
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value) * 1_000_000;
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 1000) / 1000;
}

/** 過去データの料金を pricing オブジェクトの形に寄せる。 */
export function prevPricing(prev) {
  if (!prev) return null;
  if (prev.pricing) return prev.pricing;
  if (typeof prev.input === 'number' && typeof prev.output === 'number') {
    return {
      input: prev.input,
      output: prev.output,
      currency: 'USD',
      unit: 'per_1m_tokens',
      conditions: null,
    };
  }
  return null;
}

/**
 * @param {object} params
 * @param {string[]} params.targets 取得したい source_id
 * @param {Map<string, any>} params.apiModels API 応答（id → モデル）
 * @param {any} params.published 公開データ
 * @param {string} params.today YYYY-MM-DD
 * @param {(line: string) => void} [params.onHint] 人が確認すべき点の通知
 */
export function mergeModels({ targets, apiModels, published, today, onHint = () => {} }) {
  const prevById = new Map((published?.models ?? []).map((m) => [m.source_id, m]));
  const models = [];
  const unavailable = [];
  const carried = new Set();
  const hints = [];

  for (const sourceId of targets) {
    const prev = prevById.get(sourceId);
    const raw = apiModels.get(sourceId);
    const input = raw ? toPerMillion(raw.pricing?.prompt) : null;
    const output = raw ? toPerMillion(raw.pricing?.completion) : null;
    const contextOk = Number.isInteger(raw?.context_length) && raw.context_length > 0;

    // 取得できなかった場合は、公開済みの内容をそのまま残す。
    // 「API に無い＝存在しない」とは限らないため、勝手に落とさない。
    if (!raw || input === null || output === null || !contextOk) {
      const reason = !raw
        ? 'API に見つからない'
        : !contextOk
          ? 'context_length が不正'
          : '価格が不正';
      unavailable.push(`${sourceId}（${reason}）`);
      if (prev) {
        models.push({ ...prev, fetched_at: prev.fetched_at ?? null });
        carried.add(sourceId);
      }
      continue;
    }

    const prevPrice = prevPricing(prev);
    models.push({
      id: prev?.id ?? sourceId.split('/').pop().replaceAll('.', '-'),
      name: raw.name.replace(/^[^:]+:\s*/, ''),
      vendor: prev?.vendor ?? raw.name.split(':')[0],
      tier: prev?.tier ?? 'balanced',
      context: raw.context_length,
      pricing: {
        input,
        output,
        currency: 'USD',
        unit: 'per_1m_tokens',
        // 条件付き料金は API から分からない。人が確認した値だけを引き継ぐ。
        conditions: prevPrice?.conditions ?? null,
      },
      // 重みの公開可否は API から決められない。新しいモデルは未確認のまま残し、
      // Hugging Face ID の有無で true にしない。
      open_weights: prev ? (prev.open_weights ?? null) : null,
      open_weights_basis: prev ? (prev.open_weights_basis ?? 'unverified') : 'unverified',
      licence: prev?.licence ?? { name: null, verified: false },
      note: prev?.note ?? '',
      source_id: sourceId,
      source_url: `https://openrouter.ai/${sourceId}`,
      fetched_at: today,
    });

    if (!prev && raw.hugging_face_id) {
      const line = `${sourceId} は Hugging Face ID あり（${raw.hugging_face_id}）。重みの公開可否とライセンスは人が確認してください。`;
      hints.push(line);
      onHint(line);
    }
  }

  return { models, unavailable, carried, hints };
}

/** 公開データとの差分を人が読める行にする。 */
export function diffModels({ models, published, carried = new Set() }) {
  const prevById = new Map((published?.models ?? []).map((m) => [m.source_id, m]));
  const changes = [];
  for (const m of models) {
    const prev = prevById.get(m.source_id);
    if (!prev) {
      changes.push(`追加: ${m.name}（重み・ライセンスは未確認）`);
      continue;
    }
    const prevPrice = prevPricing(prev);
    if (prev.context !== m.context) {
      changes.push(`変更: ${m.name} context ${prev.context} → ${m.context}`);
    }
    for (const key of ['input', 'output']) {
      if (prevPrice?.[key] !== m.pricing[key]) {
        changes.push(`変更: ${m.name} ${key} ${prevPrice?.[key]} → ${m.pricing[key]}`);
      }
    }
    if (carried.has(m.source_id)) {
      changes.push(`据え置き: ${m.name}（API から取得できず、公開済みの値を維持）`);
    }
  }
  return changes;
}

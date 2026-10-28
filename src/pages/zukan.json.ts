import type { APIRoute } from 'astro';
import zukan from '../../data/zukan.json';
import { toPublicEntity } from '../lib/zukan.mjs';
import { withBase } from '../lib/site.mjs';

/**
 * AI図鑑のデータをそのまま配布する JSON。
 *
 * 他サイトや自分のメモから参照できるようにするための出力で、サイトの表示より多い情報は載せない。
 * 金額はこのファイルに書かない。価格は取得日・通貨・税の扱いとセットでしか意味を持たないため、
 * ここでは参照先のスナップショットIDだけを渡し、数値は data/zukan-pricing.json 側に置いている。
 */
export const GET: APIRoute = () => {
  const entities = zukan.entities.map((entity) => ({
    ...toPublicEntity(entity, { kinds: zukan.kinds, pricing: null }),
    url: withBase(`/zukan/${entity.slug}/`),
  }));

  const body = {
    schema_version: zukan.schema_version,
    updated_at: zukan.updated_at,
    policy: zukan.policy,
    taxonomies: {
      kinds: zukan.kinds,
      use_cases: zukan.use_cases,
      interfaces: zukan.interfaces,
      platforms: zukan.platforms,
      access_routes: zukan.access_routes,
    },
    entities,
  };

  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};

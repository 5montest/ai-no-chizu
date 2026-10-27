import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import remarkGuideLinks from './src/plugins/remark-guide-links.mjs';
import remarkBulletLabels from './src/plugins/remark-bullet-labels.mjs';
import { DEFAULT_BASE, DEFAULT_ORIGIN, normalizeBase } from './src/lib/site.mjs';

// 公開先はここだけで決める。既定は現在の配信先（ルートの index.html が ./site/ へ転送する）。
//   独自ドメイン:   SITE_ORIGIN=https://example.com SITE_BASE=/ npm run build
//   サブパス配信:   SITE_BASE=/docs npm run build
//   手元で確認:     npm run dev（site は http://localhost:4321 になる）
const SITE_ORIGIN = (process.env.SITE_ORIGIN || DEFAULT_ORIGIN).replace(/\/+$/, '');
const SITE_BASE = normalizeBase(process.env.SITE_BASE ?? DEFAULT_BASE);

export default defineConfig({
  site: SITE_ORIGIN,
  base: SITE_BASE,
  trailingSlash: 'always',
  output: 'static',
  outDir: './site',
  build: {
    format: 'directory',
  },
  integrations: [mdx()],
  markdown: {
    // 本文中の [[用語]] と / 始まりのリンクにも、設定した base を付ける。
    // 箇条書きのラベル強調は、リンク展開が済んだ後の文字列に対して行う。
    remarkPlugins: [
      [remarkGuideLinks, { base: SITE_BASE }],
      remarkBulletLabels,
    ],
    shikiConfig: {
      themes: {
        light: 'vitesse-light',
        dark: 'vitesse-dark',
      },
      wrap: true,
    },
  },
});

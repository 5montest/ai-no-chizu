import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import remarkGuideLinks from './src/plugins/remark-guide-links.mjs';

// 公開URL: http://192.168.8.10:8090/20261027-website-design-implementation/site/
// ルートの index.html が ./site/ へ転送する。
export default defineConfig({
  site: 'http://192.168.8.10:8090',
  base: '/20261027-website-design-implementation/site',
  trailingSlash: 'always',
  output: 'static',
  outDir: './site',
  build: {
    format: 'directory',
  },
  integrations: [mdx()],
  markdown: {
    remarkPlugins: [remarkGuideLinks],
    shikiConfig: {
      themes: {
        light: 'vitesse-light',
        dark: 'vitesse-dark',
      },
      wrap: true,
    },
  },
});

# AIの地図

成人向けのAI解説サイトです。設計書 `ai-guide-outline.md` をもとに、章ごとに短いページを積み上げる構成で作っています。Astro + MDX の静的サイトで、検索・用語辞典・相互参照・インタラクティブなクイズを備えます。

公開URL: <http://192.168.8.10:8090/20261027-website-design-implementation/>

## 構成

```
.
├── index.html                 # /site/ へ転送するルートページ
├── astro.config.mjs           # base パス、MDX、図の設定
├── public/favicon.svg
├── data/
│   └── model-comparison.json  # 公開用のモデル比較データ（確認日つき）
├── scripts/
│   ├── fetch-model-data.mjs   # 取得して data/staging/ に書く
│   └── validate-data.mjs      # スキーマ・日付・単価を検証
├── src/
│   ├── content.config.ts      # frontmatter のスキーマ
│   ├── content/chapters/      # 章ごとの MDX（01/02-mmd...）
│   ├── components/            # 図、クイズ、表、注釈など
│   ├── layouts/
│   ├── pages/                 # 動的ルート、検索JSON、辞典、クイズ
│   ├── data/                  # カリキュラム、用語、図の定義
│   └── plugins/               # [[用語]]・[[ch:...]] を解決する remark
└── site/                      # ビルド成果物（公開対象）
```

## コマンド

```bash
npm install          # 依存関係の導入
npm run dev          # 開発サーバー
npm run build        # site/ へ静的生成
npm run preview      # 生成物の確認
npm run check        # 型・テンプレートの検査
npm run validate:data
npm run fetch:models # 比較データの取得（staging のみ更新）
```

`build` の出力先は `site/` です。ルートの `index.html` が `./site/` へ転送します。

## ページの追加

`src/content/chapters/<章番号>/<slug>.mdx` を追加します。frontmatter は `src/content.config.ts` のスキーマに従います。

```yaml
---
chapter: '12'
title: 'ページのタイトル'
description: '一覧や検索に出す短い説明'
section: '第III部 LLMを使えるシステムにする'
order: 2
level: intermediate      # intro | intermediate | advanced
readingMinutes: 9
updated: '2026-10-27'
tags: ['エージェント', '設計']
glossary: ['agent', 'harness']
summary:
  - '3行でいうと1行目。'
  - '3行でいうと2行目。'
  - '3行でいうと3行目。'
quiz:
  - question: '問題文'
    options: ['選択肢1', '選択肢2', '選択肢3', '選択肢4']
    answer: 0
    explanation: '回答後に展開する解説。'
sources:
  - title: '出典名'
    url: 'https://example.com/'
    publisher: '発行元'
    note: '何を確認したか'
---
```

本文では次のコンポーネントが使えます（MDX の frontmatter 直後に import が必要です）。

```mdx
import Diagram from '../../../components/Diagram.astro';
import Callout from '../../../components/Callout.astro';
import DeepDive from '../../../components/DeepDive.astro';
import ModelTable from '../../../components/ModelTable.astro';
```

- `<Diagram name="agent-loop" />` — `src/data/diagrams.ts` に登録済みの図を描画します。未登録の名前はビルド時にエラーになります。
- `<Callout type="myth">…</Callout>` — 誤解しやすい点の注釈。
- `<DeepDive title="…">…</DeepDive>` — 折りたたみの深掘り。
- `<ModelTable />` — 比較データの表（並べ替え付き）。

### 相互参照

本文中の記法はビルド時に解決されます。

- `[[token]]` — 用語辞典の該当項目へリンク。
- `[[token|トークン]]` — 表示名を指定。
- `[[ch:12]]` — 章トップへリンク。
- `[[ch:12/02-harness]]` — 特定ページへリンク。
- `[[ch:12/02-harness|モデルの外側]]` — 表示名を指定。

存在しない用語・章・ページを指すとビルドが失敗します。リンク切れを早期に見つけるための仕組みです。

## モデル比較データの更新

価格・コンテキスト長は変化が早いため、本文と切り離して管理します。

1. `npm run fetch:models` で `data/staging/` に取得結果を書く。
2. 差分を確認し、出典・確認日・単価の単位を検証する。
3. `npm run validate:data` を通す。
4. 内容を確認して `data/model-comparison.json` に反映する。
5. `npm run build` で再生成する。

**自動では公開データを書き換えません。** 取得と公開の間に人のレビューを挟みます。表は能力の順位ではなく、確認日時点の価格と文脈長の一覧です。単一の「最強モデル」は提示しません。

## 検証時の注意

このリポジトリはメモリを共有するホスト上にあります。ブラウザ検証は同時に1インスタンスだけ起動し、`flock --wait 120 /immich/media/agent-hub-data/browser-work.lock <コマンド>` の下で順番に実行してください。検証用のプロセスは終了時に必ず回収します。

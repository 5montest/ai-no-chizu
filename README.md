# AIの地図

AIの仕組みや活用方法を基礎から学べる解説サイトです。`docs/ai-guide-outline.md` の構成案をもとに、内容を章ごとの短いページに分けています。Astro と MDX で構築した静的サイトで、検索、用語辞典、ページ間の相互参照、クイズを利用できます。

確認用URL（ローカルネットワーク内）: <http://192.168.8.10:8090/20261027-website-design-implementation/>

## 構成

```
.
├── index.html                 # /site/ に転送するルートページ
├── astro.config.mjs           # ベースパス、MDX、図の設定
├── public/favicon.svg
├── data/
│   └── model-comparison.json  # 公開用のモデル比較データ（確認日つき）
├── docs/                      # 章構成案、スライド化の設計
├── scripts/
│   ├── fetch-model-data.mjs   # 比較データを取得して staging に保存
│   ├── validate-data.mjs      # 比較データを検証
│   └── validate-content.mjs   # 記事・用語・図の参照関係を検証
├── src/
│   ├── content.config.ts      # frontmatter のスキーマ
│   ├── content/chapters/      # 章ごとの MDX ファイル
│   ├── components/            # 図、クイズ、表、補足など
│   ├── layouts/
│   ├── pages/                 # 動的ルート、検索用 JSON、用語辞典、クイズ
│   ├── data/                  # カリキュラム、用語、図の定義
│   └── plugins/               # [[用語]]・[[ch:...]] を解決する remark
├── test/                      # テスト
├── .github/workflows/ci.yml   # GitHub Actions の検証
└── site/                      # ビルド成果物
```

## コマンド

```bash
npm install          # 依存関係の導入
npm run dev          # 開発サーバー
npm run build        # site/ へ静的生成
npm run preview      # 生成物の確認
npm run check        # 型・テンプレートの検査
npm run test         # テスト
npm run validate:data
npm run validate:content
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

### 用語やページへのリンク

本文中の記法はビルド時に解決されます。

- `[[token]]` — 用語辞典の該当項目へリンク。
- `[[token|トークン]]` — 表示名を指定。
- `[[ch:12]]` — 章トップへリンク。
- `[[ch:12/02-harness]]` — 特定ページへリンク。
- `[[ch:12/02-harness|モデルの外側]]` — 表示名を指定。

存在しない用語、章、ページを指定するとビルドが失敗します。リンク切れをビルド時に検出できます。

## モデル比較データの更新

価格やコンテキスト長は頻繁に変わるため、本文とは別に管理します。

1. `npm run fetch:models` を実行し、取得結果を `data/staging/` に保存する。
2. 差分を確認し、出典、確認日、単価の単位を確かめる。
3. `npm run validate:data` でデータを検証する。
4. 内容を確認したうえで、`data/model-comparison.json` に反映する。
5. `npm run build` を実行してサイトを再生成する。

取得したデータが公開用ファイルを自動で書き換えることはありません。内容を確認してから `data/model-comparison.json` に反映します。比較表には、確認日時点の価格とコンテキスト長を掲載します。モデルの能力を順位づけたり、単一の「最強モデル」を示したりするものではありません。

## 検証時の注意

このリポジトリをメモリを共有するホスト上で検証する場合は、ブラウザを同時に複数起動しないでください。次のコマンドでロックを取得し、ブラウザ検証を順番に実行します。検証が終わったら、起動したプロセスを終了してください。

```bash
flock --wait 120 /immich/media/agent-hub-data/browser-work.lock <コマンド>
```

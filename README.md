# AIの地図

AI・LLMの基本原理から、製品の選び方、業務導入の判断、コーディングエージェントによる実装まで学べる公開ガイドです。

公開サイト: <https://5montest.github.io/ai-no-chizu/>

`docs/ai-guide-outline.md` の構成案をもとに、内容を章ごとの短いページに分けています。Astro と MDX で構築した静的サイトで、検索、用語辞典、ページ間の相互参照、クイズを利用できます。

## このサイトで学べること

- AI・機械学習・LLMの原理と、学習・推論の仕組み
- 生成AIに仕事を頼むときの指示の組み立てと、誤りへの備え
- モデルと製品を、条件をそろえて比べる観点
- 社内導入の判断に使う、品質・費用・運用の確かめ方
- CLIエージェントを使った実装と、変更の検証

## 学習の入口

`/start/` に、目的別の**5つの学習ルート**を用意しています。全章を順読する必要はありません。

- AIの仕組みを学びたい方：AI・LLMの基本原理を順に学ぶ
- 生成AIを使い始めたい方：まず、一つの仕事で試す
- モデルや製品を選びたい方：モデルと製品を、同じ条件で比較する
- 社内導入を判断する方：効果・費用・運用を確かめる
- AIエージェントを開発したい方：CLIエージェントで実装し、変更を検証する

章の一覧は `/chapters/`、用語は `/glossary/`、製品の比較は `/zukan/`、導入前の確認項目は `/checklist/` にあります。章数とページ数はサイト上で確認してください。

GPTで生成した解説図は `public/images/guide/`、代替テキストと章の対応は `src/data/guide-images.ts`、生成プロンプトとアイコンの出典は `docs/visual-assets-2026-10-28.md` にあります。読み方・図・本文を変更した場合は、検索対象と折りたたみ内への目次移動も確認してください。

今回の監査と改修の判断は `docs/completion-audit-2026-10-28.md` に記録しています。

## 開発・プレビュー

```bash
npm install
npm run dev      # http://localhost:4321 で確認
npm run build    # site/ へ静的生成
npm run preview  # 生成物を確認
```

`astro.config.mjs` の `SITE_ORIGIN` と `SITE_BASE` が公開先を決めます。未設定のときは、この作業環境のローカル確認用URL（`http://192.168.8.10:8090/20261027-website-design-implementation/site`）を既定値にしています。GitHub Pages へは `.github/workflows/ci.yml` が `SITE_ORIGIN=https://5montest.github.io` と `SITE_BASE=/ai-no-chizu` を渡してビルドするため、既定値のまま公開されることはありません。

## 更新・検証

```bash
npm run check             # 型・テンプレートの検査
npm run validate:data     # モデル比較データの検証
npm run validate:content  # 記事・用語・図・リンクの整合性
npm run validate:zukan    # AI図鑑データの整合性
npm test                  # テスト
npm run build             # ビルド
```

GitHub Actions の `CI` が、push と pull request のたびに同じ検査を実行します。公開は `main` への push 時に、検査を通過した場合だけ行われます。

## 報告・修正の連絡

誤記、リンク切れ、古くなった記述は、リポジトリの Issue で知らせてください。<https://github.com/5montest/ai-no-chizu/issues>

## ライセンス

このリポジトリの再利用条件は、いま決めていません。決めるまでは、無断での再利用を許すものではありません。文章・図・コードそれぞれの条件は、著者が決めたうえでこの節に追記します。

第三者のロゴ、商標、引用した文章・画像は、このサイトの独自素材とは別に扱います。出典は `docs/visual-assets-2026-10-28.md` と各ページの「出典・参考資料」に記録しています。

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
│   ├── pages/                 # 動的ルート、検索用 JSON、用語辞典、クイズ、サイトマップ
│   ├── data/                  # カリキュラム、用語、図の定義
│   └── plugins/               # [[用語]]・[[ch:...]] を解決する remark
├── test/                      # テスト
├── .github/workflows/ci.yml   # GitHub Actions の検証
└── site/                      # ビルド成果物
```

## コマンド

上の「開発・プレビュー」「更新・検証」に加えて、比較データの取得に使うコマンドがあります。

```bash
npm run fetch:models  # 比較データを取得して staging に保存（公開用ファイルは書き換えない）
```

`build` の出力先は `site/` です。リポジトリ直下の `index.html` は、ローカルで開いたときに `./site/` へ転送するためのページです。GitHub Pages へは `site/` の中身だけを配信するため、この転送ページは公開されません。

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
import ProbabilityChart from '../../../components/ProbabilityChart.astro';
import PriceCompareChart from '../../../components/PriceCompareChart.astro';
```

- `<Diagram name="agent-loop" />` — `src/data/diagrams.ts` に登録済みの図を描画します。未登録の名前はビルド時にエラーになります。
- `<Callout type="myth">…</Callout>` — 誤解しやすい点の注釈。
- `<DeepDive title="…">…</DeepDive>` — 折りたたみの深掘り。
- `<ModelTable />` — 比較データの表（並べ替え付き）。
- `<ProbabilityChart />` — `src/data/next-token-example.ts` の確率分布の棒グラフ。
- `<PriceCompareChart />` — `src/data/model-comparison.json` の料金とコンテキスト長の比較。

### 箇条書きのラベル

項目の頭に名詞のラベルを置くときは、全角コロンで説明と区切り、文末に句点を付けます。ラベルはビルド時に `<b>` で出力するため、本文に `**` は書きません（`src/plugins/remark-bullet-labels.mjs`）。

```mdx
- Greedy：毎回、最も確率の高いトークンを選ぶ。
```

`<b>` を使うのは、このラベルが「読み出しの目印」であって、強い重要性や深刻さを伝えるものではないためです。`<strong>` は重要性そのものを表す要素なので、ラベルの装飾には使いません。文中で本当に強調したい箇所に限り、MDX の `**` を書いてください。

「名前は動詞で具体的に。…」のように句点で説明が続く文の項目は、ラベルではなく文として扱われ、太字になりません。書き分けはこの2つだけです。

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

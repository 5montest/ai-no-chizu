# 解説図の制作記録（2026-10-28）

生成には組み込みの `image_gen` を使用。APIキーを使うCLIは使用していない。生成後に内容と日本語を目視確認し、配信用にWebPへ圧縮した。元のPNGとプロンプトは今回の作業フォルダの `output/imagegen/` に保存している。

## 配信用アセット

- `public/images/guide/model-app-provider.webp`（原本：`output/imagegen/model-app-provider.png`）
- `public/images/guide/context-rag-training.webp`（原本：`output/imagegen/context-rag-training.png`）
- `public/images/guide/agent-approval.webp`（原本：`output/imagegen/agent-approval.png`）
- `public/images/guide/llm-response.webp`（原本：`output/imagegen/llm-response.png`）
- `public/images/guide/business-workflow.webp`（原本：`output/imagegen/business-workflow.png`）
- `public/images/guide/data-boundary.webp`（原本：`output/imagegen/data-boundary.png`）

## 生成プロンプト

### model-app-provider

```text
Use case: infographic-diagram. Asset type: Japanese educational website diagram for office workers with no programming background. Create a polished editorial infographic, landscape 3:2, pure white background, generous whitespace, navy text, blue #0b5fa5 and sage green accents, crisp simple flat illustrations with subtle paper texture, Japanese sans-serif, no small text. Topic: distinguish the provider, the AI model, and the app. Three clearly separate horizontal lanes with big numbers and exact Japanese labels: "1 提供元" with a simple office building illustration and small label "開発・提供する組織"; "2 モデル" with an abstract network chip and small label "入力から応答を作る"; "3 アプリ" with laptop chat UI plus document and search icons, small label "人が使う画面と機能". Connect provider to model with arrow labeled "開発", model to app with arrow labeled "利用". Top heading exact "同じ「AI」でも、指しているものが違う". Bottom note exact "製品の使いやすさは、モデルだけでは決まらない". Do not show real brand logos, invented company names, capabilities, numeric performance or code. Diagram should teach roles not imply that one provider always has one model or app.
```

### context-rag-training

```text
Use case: infographic-diagram. Asset type: Japanese AI learning guide explanatory diagram. Landscape 3:2, white background, navy large Japanese sans-serif labels, blue #0b5fa5, sage green and warm amber accents, simple flat line illustrations, spacious polished textbook editorial style. Three stacked lanes with clear separation. Heading exact "資料を使う方法は、一つではない". Lane 1 heading "資料をそのまま渡す": document icon -> prompt/chat context box -> model chip -> answer bubble. Small note "必要な資料を入力に含める". Lane 2 heading "検索して渡す（RAG）": question icon -> magnifying glass searching several documents -> selected document plus question -> SAME model chip -> answer bubble with citation. Small note "関連する部分を探して入力に含める". Lane 3 heading "追加学習する": training examples -> gear with circular updating arrow -> changed model chip. Small note "例から学び、モデルの重みを更新する". Bottom note exact "資料を渡すこと・検索すること自体は、モデルの追加学習ではない". The first two model chips are identical and have NO update arrow. No brand marks, no tiny text, no unsupported promises of accuracy or automatic persistent memory.
```

### agent-approval

```text
Use case: infographic-diagram. Asset type: Japanese AI guide diagram for business decision makers. Landscape 3:2, white background, navy Japanese sans-serif type, blue #0b5fa5, sage green and warm amber accents, large easy to read labels, crisp flat editorial illustrations and generous whitespace. Heading exact "AIの判断と、実行する権限を分ける". Show upper circular flow with four distinct blue/green nodes and arrows: "目的を受け取る" with task document, "次の作業を選ぶ" with AI chip, "ツールで調べる" with search and file, "結果を確認する" with checklist. Feedback arrow from result back to next task, NOT automatically executing forever. Lower branch from choose task leads to amber gate node "送信・更新の前に確認", illustrated human reviewer and an approval checkbox; after gate a blue node "許可した操作だけ実行" with envelope / file update. Label branch "外部への送信・データの変更". Small bottom note exact "承認・利用上限・停止条件は、仕組みの側で決める". No promise of autonomous safety, no robots or anthropomorphic AI characters, no brand logos.
```

### llm-response

```text
Use case: infographic-diagram. Japanese educational diagram for non-programmer office workers. Landscape 3:2 white background, polished flat editorial illustrations, navy Japanese sans-serif type, generous whitespace, blue #0b5fa5 with sage green and warm amber accents. Heading exact "文章は、続きを選ぶ処理で作られる". Show an office worker's input card labeled "質問・指示・資料", arrow to numbered step "1 小さな単位に分ける" with several blank token tiles, arrow to "2 文脈から次を予測" with simple network chip and three candidate tokens of differing visual prominence (no invented numerical probabilities), arrow to "3 一つ選んで追加" with growing line of tiles, arrow to "4 文章として表示" with a chat bubble. Clear curved repeat arrow from step 3 back to step 2 labeled "終了まで繰り返す". Small inline label "小さな単位＝トークン". Bottom prominent amber note exact "自然な文章でも、事実が正しいとは限らない". The diagram simplifies autoregressive text generation, not a search engine and not a file of memorized answers. No brands, no robot heads, no tiny text.
```

### business-workflow

```text
Use case: infographic-diagram. Japanese AI business guide diagram for people starting to use generative AI at work. Landscape 3:2, white background, navy Japanese sans-serif labels, blue #0b5fa5, sage green and warm amber accents, clean flat editorial illustrations with lots of whitespace. Heading exact "問い合わせ対応を、工程で分ける". A large clear left-to-right process illustrated in two rows connected as ONE process: "受け付ける" inbox with example question, then blue "AIが下書き" model chip next to draft text with three lines, then amber "人が原文と照合" human reviewer with original reference document and checklist, then green "担当者が送信" envelope. Small label above AI step "任せる範囲を限定". Below reviewer branch show "不明・資料不足" -> "人に引き継ぐ" human icon. Bottom note exact "作成時間だけでなく、確認と修正の時間も測る". No promise that review eliminates all errors, no unverifiable numerical savings, no brands, no decorative paragraphs.
```

### data-boundary

```text
Use case: infographic-diagram. Japanese AI guide on data handling for office workers and internal adoption decision makers. Landscape 3:2, pure white background, navy large Japanese sans-serif, blue #0b5fa5, sage green and amber accents, flat editorial illustrations, generous whitespace. Heading exact "入力する前に、情報の行き先を確かめる". Left large outlined region labeled "社内" containing worker laptop, folder labeled "業務資料", and a reviewer checkpoint labeled "送ってよい情報か". Right outlined region labeled "利用するサービス" containing cloud with AI chip and three separate clearly distinguishable cards "学習への利用", "保存・削除", "外部ツールへの転送". Arrow from company checkpoint across boundary to cloud labeled "確認した範囲だけ送る". A separate return arrow cloud to company laptop labeled "出力も確認する". Bottom emphasized amber note exact "「学習に使わない」と「保存しない」は別の条件". Do not imply local execution guarantees no data transfer. No brand logos, no legal guarantees, no padlocks suggesting absolute security.
```

## 公式サイトのアイコン

OpenAI、Claude（Anthropic）、Google AI、DeepSeek、Qwenの公式サイトが配布するアイコンを使用。参照元と確認日は `public/images/providers/sources.json`。既存ブランドのロゴをAI生成で作り直してはいない。

## 使い方

`GuideImage` コンポーネントが拡大リンク、代替テキスト、文章による説明を表示する。登録情報は `src/data/guide-images.ts`。図の文言を変える場合は、画像と代替テキスト・本文を一緒に確認する。

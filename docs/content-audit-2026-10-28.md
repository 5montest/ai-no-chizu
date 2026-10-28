# コンテンツ事実監査レポート

- 監査日: 2026-10-28
- 対象: `src/content/chapters/` の68章、各章の本文・要約・クイズ・参考資料、`src/data/glossary.json` の59用語、モデル比較データと価格説明
- 監査目的: 内容上の誤り、過度な一般化、出典不足、時点依存情報を一次資料・公式資料と照合して特定する
- 変更範囲: 本レポートのみ。監査対象のコンテンツ、生成済みサイト、Git履歴は変更していない

## 結論

明確な事実誤認を3件確認した。加えて、技術上の説明が強く一般化されている箇所、価格や製品仕様の更新で古くなった箇所、主張を追跡できる出典がない箇所がある。

全章の文章・要約・クイズを確認したが、現在のサイトは各文と一次資料の対応が一律に記録されている構成ではない。したがって、文ごとに出典をクリックして再検証できる「一次資料付きの監査可能性」は満たしていない。出典がない推奨や予測は、それが事実の断定として書かれていないかを確認し、該当箇所として記録した。本文を改稿したり、出典を推測で補ったりはしていない。

## 判定基準と確認方法

- **誤り**: 一次資料・公式資料と矛盾する、または数学的定義と異なる説明。
- **要修正**: 核心は妥当でも、適用範囲を限定しないことで誤解を招く説明。
- **根拠不足**: 数値・頻度・因果関係など、検証可能な主張に直接対応する資料がない。
- **要更新**: 価格、製品仕様など、確認日以降に変わりうる情報。
- **問題なし（この監査範囲内）**: 該当する主張を参照資料が支持している。推奨・比喩・例示は、それ自体を事実とは扱わない。

章の参考資料、本文中の技術主張、用語集、表の数値と日付を読み合わせ、一次論文・公式文書・提供元の公式仕様を優先して確認した。外部参照URLは119件を到達確認し、115件は応答を確認、4件は自動取得で403となった。403はリンク切れを意味しないが、その場で本文の内容まで確認できなかった。

## 優先度の高い指摘

### A. 明確な誤り

#### A1. AlexNet論文の出典URLが別論文

- 該当: [`02/02-learning-turn.mdx:42–45`](../src/content/chapters/02/02-learning-turn.mdx#L42)
- 内容: 「ImageNet Classification with Deep Convolutional Neural Networks」のリンク先 `arXiv:1207.0580` は、AlexNet論文ではない。
- 根拠: [NeurIPS掲載のAlexNet原論文](https://proceedings.neurips.cc/paper/2012/hash/c399862d3b9d6b76c8436e924a68c45b-Abstract.html)
- 修正案: URLをNeurIPS原論文または正しい論文識別子へ差し替え、書誌情報を照合する。

#### A2. コサイン類似度0／負の値を意味上の無関係／反対と結び付けている

- 該当: [`05/02-embedding.mdx:78`](../src/content/chapters/05/02-embedding.mdx#L78)
- 内容: 「0に近いほど無関係、負なら逆方向」とだけ説明すると、ベクトル間の幾何学的関係を意味の関係だと誤解させる。0は直交、負は角度が90度を超えることを表すが、それだけで意味上の無関係・反対は結論できない。
- 根拠: [Is Cosine-Similarity of Embeddings Really About Similarity?](https://arxiv.org/abs/2403.05440) は、学習された埋め込みのコサイン類似度が意味を持たない場合もあると分析している。
- 修正案: 数学上の説明と、学習済み空間での関連度の解釈を分ける。「意味的な関連の目安になるかは、モデルと学習方法に依存する」と補う。
- 補足: 同章85行目の注意書きは有用だが、78行目の誤解を招く定義を打ち消すには不十分。

#### A3. 拡散モデルは訓練画像を記憶しないという断定

- 該当: [`15/01-diffusion.mdx:70`](../src/content/chapters/15/01-diffusion.mdx#L70)、同章93行目
- 内容: ノイズ除去を学ぶという目的の説明から、「画像を記憶しない」と結論している。目的関数と、訓練データを記憶・再現する可能性は別の論点。
- 根拠: [Extracting Training Data from Diffusion Models](https://arxiv.org/abs/2301.13188) は、複数の拡散モデルが訓練画像を記憶し、生成時に出力しうることを示している。
- 修正案: 「学習ではノイズを予測するが、モデルが訓練画像を記憶しない保証にはならず、記憶・再現が起きる場合がある」と説明する。

### B. 読者の理解や実務判断に影響する説明

#### B1. ロボットはアクチュエータを直接制御しないという一般化

- 該当: [`17/01-perceive-plan-act.mdx:91`](../src/content/chapters/17/01-perceive-plan-act.mdx#L91)
- 内容: 「ここを直接AIが制御するのではなく、目標値を渡す構成が普通」としている。階層型制御では自然な説明だが、ロボット学習モデルの出力方式を一様に説明する文になっている。
- 根拠: [RT-1の公式技術紹介](https://research.google/blog/rt-1-robotics-transformer-for-real-world-control-at-scale/) は、視覚・指示に加えモーターコマンドをトークン化して行動出力に扱うモデルを説明している。
- 修正案: 高レベルの行動出力と低レベルの制御器を分ける構成がある、と範囲を限定する。トークン化された行動が最終的にどの制御信号になるかは実装ごとに異なると説明する。

#### B2. Transformerは各位置から他の全位置を参照できるという説明

- 該当: [`06/01-transformer.mdx:68`](../src/content/chapters/06/01-transformer.mdx#L68)
- 内容: Transformer全般の説明としては広すぎる。Encoderの自己注意では全位置を参照できる一方、標準的な自己回帰Decoderは未来位置を見ないよう因果マスクを使う。同ページの後段ではDecoder-onlyの因果マスクにも触れており、説明間にずれがある。
- 根拠: [Attention Is All You Need](https://arxiv.org/abs/1706.03762) の原論文は、Decoderの自己注意に未来位置を隠すマスクを用いる。
- 修正案: 「Encoderでは全位置を参照できる。自己回帰Decoderでは因果マスクにより過去と現在だけを参照する」と区別する。

#### B3. Attentionの計算量を行列要素数だけで説明

- 該当: [`06/02-attention.mdx:114–117`](../src/content/chapters/06/02-attention.mdx#L114)
- 内容: 系列長を2倍にしたときスコア行列の要素数が4倍という説明は妥当。ただし「計算の手間は、この規模に比例」とするだけでは、隠れ次元に依存する計算量が抜けている。メモリ保存量と計算量を同じもののように読める。
- 根拠: [Transformer原論文](https://arxiv.org/abs/1706.03762) のAttention計算は系列長と隠れ次元に依存する。
- 修正案: 行列要素数／保存量は系列長の二乗で増えることと、計算量には隠れ次元も関わることを分けて述べる。FlashAttentionの説明は別途、実装がメモリ使用を減らす話として残せる。

#### B4. Prompt Injectionを「指示とデータが一つの列で区別されない」と説明

- 該当: [`09/03-bias-and-trust.mdx:68`](../src/content/chapters/09/03-bias-and-trust.mdx#L68)
- 内容: Chat APIのメッセージにはroleなどの構造があるため、「構造的に区別がない」と受け取られる表現は不正確。一方、その構造がセキュリティ上の信頼境界として働かず、外部コンテンツの命令がモデルに影響する、という要点は正しい。
- 根拠: [OWASPのPrompt Injection解説](https://genai.owasp.org/llmrisk2023-24/llm01-24-prompt-injection/) は、モデルが命令と外部データを安全に分離できないリスクを説明する。
- 修正案: 「roleなどの構造はあるが、外部文章を信頼できないデータとして強制分離する安全境界ではない。モデルがその文章に影響されることがある」とする。

#### B5. 出力トークン価格の高さを生成方式が決めると読める

- 該当: [`05/01-tokenization.mdx:101`](../src/content/chapters/05/01-tokenization.mdx#L101)、[`18/03-price-context.mdx:65`](../src/content/chapters/18/03-price-context.mdx#L65)、[`08/03-inference-cost.mdx:134–135`](../src/content/chapters/08/03-inference-cost.mdx#L134)
- 内容: 出力を逐次生成する特性は計算コストの説明には関係するが、各社が設定する価格の理由を一般化して説明する根拠にはならない。価格は入力より出力のほうが高いことが多い、という観察と、なぜその値付けをしたかは別。
- 修正案: 「出力は逐次生成されるため計算負荷が高くなる場合がある。実際の料金と単価差は提供元の料金設定による」と因果を切り分ける。

#### B6. Ollamaがllama.cppを土台にするという説明が現在は不完全

- 該当: [`19/03-inference-engines.mdx:66`](../src/content/chapters/19/03-inference-engines.mdx#L66) とクイズ解説24行目
- 内容: llama.cppは現在もOllamaで使われるが、それを全環境での一律な基盤のように記述している。OllamaはApple Silicon向けMLXエンジンも導入している。
- 根拠: [Ollama公式のMLX発表](https://ollama.com/blog/mlx)、[GGUFとllama.cppに関する公式発表](https://ollama.com/blog/improved-performance-and-model-support-with-gguf)
- 修正案: 「Ollamaは複数の実行エンジンを使い、環境やモデル形式で異なる。GGUFを扱う構成ではllama.cppが使われる」とする。

#### B7. VLMの短い定義が厳密な定義と矛盾

- 該当: [`src/data/glossary.json:391–392`](../src/data/glossary.json#L391)
- 内容: short欄は「画像とテキストを組み合わせて理解・生成するモデル」、strict欄は「画像を理解するモデルであり、画像を生成するモデルとは限らない」としており、同一項目内で説明が食い違う。
- 修正案: short欄を「画像と言語を扱うモデル」などに変更し、生成機能は備えるモデルがある場合に限ると補足する。

#### B8. 音声の「変換が生成より多い」という題名を裏付ける比較がない

- 該当: [`16/02-speech.mdx:3`](../src/content/chapters/16/02-speech.mdx#L3)、同章68行目
- 内容: 本文では音声認識と合成の構成を説明しているが、「生成より変換が多い」という分野全体の頻度比較の母集団・指標・出典がない。WaveNetのような音声生成研究もあり、タイトルだけでは定量的事実に読める。
- 修正案: 題名を章の焦点に合わせるか、「会話型システムの多くは認識と合成を組み合わせる」など、出典を付けられる範囲に限定する。

#### B9. 著作権の説明が「各国」としながら米国資料のみ

- 該当: [`15/03-editing-and-evaluation.mdx:104–107`](../src/content/chapters/15/03-editing-and-evaluation.mdx#L104)
- 内容: 各国の権利状況を述べる段落に米国著作権局の資料しか挙げられていない。法的な説明は管轄ごとに分ける必要がある。
- 根拠: [文化庁の「AIと著作権」](https://www.bunka.go.jp/seisaku/chosakuken/aiandcopyright.html) は日本の法制度に関する公式な整理を掲載している。米国の資料は[米国著作権局の報告](https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-2-Copyrightability-Report.pdf)として区別できる。
- 修正案: 日本と米国など、対象法域と資料の基準日を明記する。法律の一般的な結論を各国共通のように述べない。

## 要更新の情報

### C1. モデル比較表の価格・価格レンジ

- 該当: [`data/model-comparison.json:223–240`](../data/model-comparison.json#L223)、[`18/03-price-context.mdx:112–118`](../src/content/chapters/18/03-price-context.mdx#L112)
- 内容: Qwen3.8 27Bのローカルデータは2026-10-27取得として入力 `$0.20`、出力 `$2.50`／100万トークンを記録している。2026-10-28の確認時点では、[OpenRouter掲載値](https://openrouter.ai/qwen/qwen3.8-27b)の表示と一致しなかった。提供元やルーティングによって価格が変わるため、表の基準と採用価格も明示が必要。
- 影響: 表の価格レンジ・安い順の説明が更新前のデータに依存する。
- 修正案: データを再取得して表示を更新するか、表全体を明確な取得時点のスナップショットとし、現在価格とは限らないと表示する。キャッシュ・プロバイダー・ルーティング条件も可能な範囲で記録する。
- 留意: 調査時点と表の基準日が1日違うため、10月27日当日の価格まで誤りだったとは断定しない。ここでは確認時点での差と更新の必要性を指摘する。

## 出典または条件の補足が必要な記述

以下は必ずしも誤りではないが、数値・頻度・範囲が無限定のままだと読者が確定事実と受け取りうる。

| 該当箇所 | 問題 | 対応案 |
| --- | --- | --- |
| [`02/01-symbolic-ai.mdx:86`](../src/content/chapters/02/01-symbolic-ai.mdx#L86) | 「規則が数百を超えると整合性維持が人の手に負えない」という閾値に出典・条件がない。 | 数値を外して、規則間の依存関係が複雑になると保守が難しくなる、とする。 |
| [`05/02-embedding.mdx:82`](../src/content/chapters/05/02-embedding.mdx#L82) | 「数百万件から短時間で検索」は索引・ハードウェア・精度条件に依存する。 | ベクトル索引の構成や検索条件に依存する例だと明記する。 |
| [`18/02-benchmarks.mdx:131`](../src/content/chapters/18/02-benchmarks.mdx#L131) | 代表タスク20〜50件が普遍的な基準のように見える。 | 「初期検証の目安」などとし、用途・リスクに応じて件数を決めると補足する。 |
| [`21/01-evaluation-design.mdx:65–71`](../src/content/chapters/21/01-evaluation-design.mdx#L65) | 「二、三のタスク」「最初は数十件」は実務上の助言であり、一次資料で決まる標準値ではない。 | 推奨の目安として表示し、固定基準ではないと明記する。 |
| [`22/01-axes.mdx:58`](../src/content/chapters/22/01-axes.mdx#L58)、[`22/03-what-to-watch.mdx:94`](../src/content/chapters/22/03-what-to-watch.mdx#L94) | 発表・モデル変更の周期を「数週間」としているが、集計期間・対象が示されていない。 | 「近年の観測例」など期間を限定して出典を示すか、変化の頻度を定性的な予測として明示する。 |
| [`21/03-operations.mdx:59`](../src/content/chapters/21/03-operations.mdx#L59) | 「こうした報告がよく届く」「通知のない変更もある」は出典のない頻度・一般化。 | 事例または提供元文書を挙げるか、「起こりうる」とリスク表現にする。 |

## 監査上おおむね妥当だった点

- [04/02-next-token.mdx:90–99](../src/content/chapters/04/02-next-token.mdx#L90) は、温度を下げても事実誤認や安全性が自動的に解決しないと説明しており、適切な注意がある。ただし同ファイル24行目のクイズ解説は「実質的に毎回同じ候補を選ぶ決定的な挙動」と強く述べるため、「より集中し再現性が上がるが、完全な決定性は保証されない」と調整するのがよい。[OpenAI APIの温度説明](https://developers.openai.com/api/reference/java/resources/responses/methods/create) も、低温度はよりfocused/deterministicと説明するが、完全一致を保証するとはしていない。
- [05/03-context-window.mdx:72、106–107](../src/content/chapters/05/03-context-window.mdx#L72) は、長文の中央で情報利用が低下しうる研究を紹介し、2023年の検証と結び付けている。適用範囲を全モデル・全タスクに広げないよう、研究条件に限定した説明を維持する。
- 第20・21章のワークフロー、人の承認、ログ、再評価の多くは、規範・実務上の推奨として表現されている。推奨に唯一の正解がない点を事実の断定と混同しなければ、本文の主要方針は妥当。ただし各社のドキュメントのトップページを列挙するだけでは個別手順の直接根拠を読者が追いにくいため、節ごとの公式文書へのリンクが望ましい。
- 第22章最終ページは「確認された事実」と「公開動向からの予測」を分けると明記している。この区別は適切だが、予測の根拠となる具体的な時系列資料や発表例があると検証しやすい。

## 主な一次・公式資料

- AlexNet: [NeurIPS 2012論文](https://proceedings.neurips.cc/paper/2012/hash/c399862d3b9d6b76c8436e924a68c45b-Abstract.html)
- 埋め込み類似度: [Is Cosine-Similarity of Embeddings Really About Similarity?](https://arxiv.org/abs/2403.05440)
- 拡散モデルの記憶: [Extracting Training Data from Diffusion Models](https://arxiv.org/abs/2301.13188)
- Transformer: [Attention Is All You Need](https://arxiv.org/abs/1706.03762)
- ロボット行動モデル: [Google Research: RT-1](https://research.google/blog/rt-1-robotics-transformer-for-real-world-control-at-scale/)
- Prompt Injection: [OWASP LLM01](https://genai.owasp.org/llmrisk2023-24/llm01-24-prompt-injection/)
- Ollamaエンジン: [MLX公式発表](https://ollama.com/blog/mlx)、[GGUF / llama.cpp公式発表](https://ollama.com/blog/improved-performance-and-model-support-with-gguf)
- 著作権: [文化庁「AIと著作権」](https://www.bunka.go.jp/seisaku/chosakuken/aiandcopyright.html)、[U.S. Copyright Office Part 2](https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-2-Copyrightability-Report.pdf)
- 温度設定: [OpenAI APIリファレンス](https://developers.openai.com/api/reference/java/resources/responses/methods/create)
- 価格: [OpenRouter Qwen3.8 27B掲載](https://openrouter.ai/qwen/qwen3.8-27b)

## 未確認・制約

- 外部URLのうち4件は監査時の自動取得で403となり、到達性または本文確認を確定できなかった。アクセス拒否をリンク切れとは扱っていない。
- 価格は提供元・配信先・キャッシュ・ルーティング・日時で変化する。監査日の比較はスナップショットであり、継続的な価格保証ではない。
- 監査は事実性と出典追跡可能性を対象にしており、法律判断や安全認証を代替するものではない。法律に関する記述は、対象国と基準日を示したうえで専門担当者による確認を残す。
- 本レポートは指摘と根拠を記録したものであり、サイト本文の改稿、生成サイトの再構築、テスト、Git commit、pushは行っていない。

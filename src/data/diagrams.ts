export interface Diagram {
  /** 章番号-連番。「図 1-1」として記事に出る。 */
  number: string;
  title: string;
  /** 図の前提を誤らないよう添える但し書き。記事側で上書きできる。 */
  caption: string;
  /** Mermaid の定義。 */
  code: string;
}

export const diagrams: Record<string, Diagram> = {
  'ai-map': {
    number: '1-1',
    title: 'AI・機械学習・深層学習の包含関係',
    caption:
      '概念図。生成AIやマルチモーダルAIは「入出力の種類」による分類でもあり、樹形図だけでは関係を表しきれない。',
    code: `flowchart TB
  AI["AI：人工知能という広い領域"]
  AI --> RB["ルールベース<br/>人が規則を書く"]
  AI --> ML["機械学習<br/>データから規則を学ぶ"]
  ML --> DL["深層学習<br/>多層のニューラルネット"]
  DL --> LLM["LLM・言語モデル"]
  DL --> VIS["画像認識・VLM"]
  DL --> GEN["画像・動画の生成モデル"]
  DL --> AUD["音声・ロボットのモデル"]
  RB --> EX["迷惑メール判定・<br/>エキスパートシステム"]
  ML --> CLS["分類・予測・推薦"]
  classDef core stroke-width:1.6px;
  classDef soft stroke-width:1.2px;
  classDef wide stroke-width:1px;
  class AI core;
  class ML,DL soft;
  class RB,LLM,VIS,GEN,AUD,CLS,EX wide;`,
  },

  'training-loop': {
    number: '3-1',
    title: '学習の1ステップと繰り返し',
    caption:
      '概念図。1回の更新で扱うのはミニバッチだけであり、学習はこの循環を何度も回す。順伝播と逆伝播は、推論時の計算とは目的が異なる。',
    code: `flowchart LR
  D["ミニバッチ<br/>学習データの一部"] --> F["順伝播<br/>予測を計算"]
  F --> L["損失<br/>予測の悪さを数値に"]
  L --> G["逆伝播<br/>各パラメータの勾配"]
  G --> U["更新<br/>学習率 × 勾配の逆向き"]
  U --> D`,
  },

  'llm-pipeline': {
    number: '4-1',
    title: '文章が返るまでの流れ',
    caption:
      '入力は一度に答えになるのではなく、トークン単位の選択を繰り返して生成される。系列の末尾に足されるのは文字列ではなくトークンIDで、過去に処理した分はKVキャッシュとして再利用する。図の順序は概念的なもので、実装ではPrefillとDecodeで進み方が異なる。',
    code: `flowchart LR
  IN["入力テキスト"] --> TOK["トークナイザー<br/>文字列を分割"]
  TOK --> IDS["トークンID<br/>語彙の番号"]
  IDS --> EMB["埋め込み<br/>ベクトルに変換"]
  EMB --> TR["Transformer<br/>文脈を混ぜる"]
  TR --> LOG["Logits<br/>次の候補と確率"]
  LOG --> SAMP["選択<br/>Temperature / Top-p"]
  SAMP --> DETOK["選んだトークンのID"]
  DETOK --> OUT["文字に戻して表示"]
  DETOK -.->|"同じIDを系列の末尾に足す<br/>過去の計算は再利用"| EMB`,
  },

  'model-service': {
    number: '4-2',
    title: 'モデル・API・アプリは別の層',
    caption:
      '「ChatGPT」という製品名は、モデル単体ではなく、UI・API・安全策・ツールを含むサービスの名前であることが多い。',
    code: `flowchart TB
  subgraph APP["アプリケーション層"]
    UI["チャットUI・業務画面"]
    CTX["コンテキスト構成<br/>指示・履歴・資料"]
    TOOL["検索・ツール・承認"]
  end
  subgraph GW["API / サービスの層"]
    AUTH["認証・ルーティング・ログ"]
  end
  subgraph MODEL["モデルの層"]
    W["学習済みの重み"]
    INF["推論エンジン"]
  end
  UI --> CTX --> AUTH --> INF --> W
  CTX <--> TOOL
  TOOL --> AUTH`,
  },

  'token-vector': {
    number: '5-1',
    title: '文字列 → トークン → ID → ベクトル',
    caption:
      '概念図。分割の仕方とID・ベクトルの数値はモデルごとに異なる。ここでは「文字のままでは計算できない」ことだけをつかめばよい。',
    code: `flowchart LR
  T["「AIは難しい」"] --> T1["AI"]
  T --> T2["は"]
  T --> T3["難"]
  T --> T4["しい"]
  T1 --> I1["1024"]
  T2 --> I2["9"]
  T3 --> I3["7781"]
  T4 --> I4["331"]
  I1 --> V1["[0.12, -0.48, …]"]
  I2 --> V2["[0.03, 0.21, …]"]
  I3 --> V3["[-0.77, 0.09, …]"]
  I4 --> V4["[0.44, 0.51, …]"]
  classDef id stroke-width:1.2px;
  class I1,I2,I3,I4 id;`,
  },

  attention: {
    number: '6-1',
    title: 'Attentionの流れ：Q・K・Vから重み付き和へ',
    caption:
      '概念図。実際には複数のヘッドが並列に計算され、その後まとめられる。スコアの計算と重み付けは、文脈を混ぜるための一手段である。',
    code: `flowchart LR
  X["入力トークン列"] --> Q["Q：問い合わせ"]
  X --> K["K：見出し"]
  X --> V["V：中身"]
  Q --> S["スコア Q·Kᵀ"]
  K --> S
  S --> SM["Softmax<br/>重みに変換"]
  SM --> W["各位置の重み"]
  V --> SUM["重み付き和"]
  W --> SUM
  SUM --> O["この位置の出力"]`,
  },

  'transformer-block': {
    number: '6-2',
    title: 'Transformerブロックの断面',
    caption:
      '正規化の位置や名前は実装で異なる（Post-LN / Pre-LN）。残差接続は、深いネットワークでも情報と勾配を通しやすくする。',
    code: `flowchart TB
  IN["入力ベクトル"] --> N1["正規化"]
  N1 --> ATT["Multi-Head Attention"]
  ATT --> R1["残差接続で足す"]
  IN --> R1
  R1 --> N2["正規化"]
  N2 --> FF["Feed Forward Network"]
  FF --> R2["残差接続で足す"]
  R1 --> R2
  R2 --> NEXT["次のブロックへ<br/>（これをN層くり返す）"]`,
  },

  'agent-loop': {
    number: '12-1',
    title: 'エージェントループとハーネス',
    caption:
      'モデルは「次の行動」を選ぶが、実行するのはハーネスと実行環境。承認・予算・停止条件もループの外側で管理する。',
    code: `flowchart TD
  U["目的・依頼"] --> H["ハーネス<br/>状態・権限・履歴を管理"]
  H --> M["モデル<br/>次の行動を選ぶ"]
  M --> D{"行動の種類"}
  D -->|"回答でよい"| A["最終回答"]
  D -->|"情報が必要"| T["ツール・検索を呼ぶ"]
  D -->|"変更が必要"| E["ファイル・コマンドを実行"]
  T --> O["観測結果"]
  E --> O
  O --> H
  H -.->|"予算・承認・停止条件"| M`,
  },

  'harness-layers': {
    number: '12-2',
    title: 'モデル／ハーネス／実行環境の責任分担',
    caption:
      '同じモデルでも、ハーネスと環境が変われば成果は変わる。逆に、ハーネスを厚くしてもモデルの知識や判断を超える保証は得られない。',
    code: `flowchart TB
  subgraph L1["モデル（頭脳）"]
    M["次トークン・次の行動を予測する"]
  end
  subgraph L2["ハーネス（外側の仕組み）"]
    P["計画・ループ"]
    S["状態・履歴・メモリ"]
    G["権限・承認・予算"]
    V["検証・テスト"]
  end
  subgraph L3["実行環境"]
    F["ファイル・ターミナル"]
    N["ネットワーク・API"]
    B["ブラウザ・Sandbox"]
  end
  M <--> P
  P <--> S
  P --> G
  P --> V
  P --> F
  P --> N
  P --> B`,
  },

  'model-selection': {
    number: '18-1',
    title: 'モデル選びの手順',
    caption:
      '「最強のモデル」から出発せず、必須条件で候補を絞り、自分の課題に近い評価で決める。評価セットは再利用できる資産になる。',
    code: `flowchart TD
  S["用途を一文で書く"] --> H{"必須条件は？"}
  H -->|"社外秘を出せない"| L["ローカル／専用環境"]
  H -->|"長い文書を読む"| C["コンテキスト長で絞る"]
  H -->|"低コスト重視"| P["軽量モデルから試す"]
  H -->|"最高品質重視"| F["フロンティアモデルを試す"]
  L --> E["小さな評価セットで比較"]
  C --> E
  P --> E
  F --> E
  E --> J{"合格ラインを満たすか"}
  J -->|"はい"| D["採用・監視"]
  J -->|"いいえ"| R["条件かモデルを見直す"]
  R --> E`,
  },

  'benchmark-reading': {
    number: '18-2',
    title: 'ベンチマークを読むときの4つの確認',
    caption:
      '点数は結論ではなく、測定条件つきの観測値。リーダーボードの順位を、自分の業務の順位に読み替えない。',
    code: `flowchart LR
  B["ベンチマークの点数"] --> W["何を測ったか"]
  W --> C["条件<br/>推論設定・ツール・回数"]
  C --> L["集計方法<br/>平均・重み・除外"]
  L --> T["自分の課題に近いか"]
  T --> E["自分の評価セットで再確認"]
  E --> D["採用判断"]`,
  },

  'training-stages': {
    number: '7-1',
    title: '学習の段階と、そこで変わるもの',
    caption:
      '概念図。各段階で使うデータと目的関数は異なる。名称や順序、使う手法の組み合わせはモデルごとに違い、事前学習だけで済ませる場合もある。',
    code: `flowchart TB
  P["事前学習<br/>大量のテキストで次のトークンを予測"] --> B["言語の構造と知識を持つ土台"]
  B --> S["教師あり微調整<br/>指示と望ましい応答の組で学ぶ"]
  S --> I["指示に従う応答"]
  I --> R["選好の調整<br/>人の比較評価を報酬にして寄せる"]
  R --> A["役に立つ形・安全側への調整"]
  A --> E["評価<br/>能力・安全性・用途別"]`,
  },

  'prefill-decode': {
    number: '8-1',
    title: 'PrefillとDecodeで進み方が変わる',
    caption:
      '概念図。Prefillは入力全体をまとめて処理し、Decodeは1トークンずつ進む。バッチ処理や投機的デコードなど、実装側の工夫でこの形は変わる。',
    code: `flowchart LR
  IN["入力プロンプト"] --> P["Prefill<br/>全トークンを並列に処理<br/>計算の重い行列演算が中心"]
  P --> K["KVキャッシュ<br/>各位置のKey・Valueを保存"]
  K --> D["Decode<br/>1トークンずつ生成<br/>メモリ読み出しが中心"]
  D --> O["出力トークン"]
  O -.->|"生成したトークンを入力に足す"| D
  K -.->|"過去の分を再利用"| D`,
  },

  'rag-pipeline': {
    number: '11-1',
    title: '検索してから答えを作る流れ',
    caption:
      '概念図。検索の対象は文書を分割した断片（チャンク）で、埋め込みの作り方と分割の仕方が結果を左右する。検索結果が誤っていれば生成側で補えない。',
    code: `flowchart LR
  Q["質問"] --> QE["質問を埋め込みに変換"]
  QE --> S["類似検索<br/>ベクトルDB・キーワード検索"]
  D["社内文書・マニュアル"] --> C["分割<br/>チャンクに切る"]
  C --> CE["各チャンクを埋め込みに変換"]
  CE --> DB[("インデックス<br/>ベクトルと本文")]
  DB --> S
  S --> R["上位の断片を取得"]
  R --> PR["プロンプトに貼る<br/>質問＋根拠"]
  PR --> M["モデルが回答を生成"]
  M --> A["回答と引用"]`,
  },

  'diffusion-steps': {
    number: '15-1',
    title: 'ノイズから画像へ：拡散モデルの生成',
    caption:
      '概念図。学習時は画像にノイズを加え、それを取り除く過程を学ぶ。生成時は逆向きに、ノイズから少しずつ像を作る。ステップ数は品質と時間のトレードオフで決まる。',
    code: `flowchart LR
  subgraph LEARN["学習"]
    IMG["元の画像"] --> NZ["ノイズを加える"]
    NZ --> T["「何ステップ目のノイズか」を条件に"]
    T --> NO["ノイズを予測するネットワーク"]
    NO --> LOSS["予測と実際のノイズの誤差"]
  end
  subgraph GEN["生成"]
    RND["ランダムなノイズ"] --> STEP["ノイズを取り除く<br/>（これを繰り返す）"]
    PR["プロンプトの埋め込み"] --> STEP
    STEP --> IMG2["画像"]
  end
  NO -.->|"学習した重みを使う"| STEP`,
  },

  'perceive-plan-act': {
    number: '17-1',
    title: '知覚・計画・行動のループ',
    caption:
      '概念図。ロボットは観測から行動までを繰り返す。実環境では知覚の誤りや遅延が避けられず、計画を立て直す仕組みと安全側で止める仕組みが要る。',
    code: `flowchart LR
  S["センサー<br/>カメラ・距離・力"] --> P["知覚<br/>何がどこにあるか"]
  P --> PL["計画<br/>次に何をするか"]
  PL --> A["行動<br/>関節・グリッパーを動かす"]
  A --> W["環境の変化"]
  W --> S
  P -.->|"把持位置の推定"| PL
  PL -.->|"危険・失敗の検知で停止"| A`,
  },
};

export const diagramNames = Object.keys(diagrams);

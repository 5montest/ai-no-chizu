export const diagrams = {
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

  'llm-pipeline': {
    number: '4-1',
    title: '文章が返るまでの流れ',
    caption:
      '入力は一度に答えになるのではなく、トークン単位の選択を繰り返して生成される。図の順序は概念的なもので、実装では並列化される。',
    code: `flowchart LR
  IN["入力テキスト"] --> TOK["トークナイザー<br/>文字列を分割"]
  TOK --> IDS["トークンID<br/>語彙の番号"]
  IDS --> EMB["埋め込み<br/>ベクトルに変換"]
  EMB --> TR["Transformer<br/>文脈を混ぜる"]
  TR --> LOG["Logits<br/>次の候補と確率"]
  LOG --> SAMP["選択<br/>Temperature / Top-p"]
  SAMP --> DETOK["トークンを文字に戻す"]
  DETOK --> OUT["出力"]
  OUT -.->|"生成した分を入力に追加"| TOK`,
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
};

export const diagramNames = Object.keys(diagrams);

export const readingPaths = [
  {
    id: 'learn', label: 'AIの仕組みを学びたい方', title: 'AI・LLMの基本原理を順に学ぶ',
    description: 'AIという言葉が指す範囲から始め、入力が処理されて文章が返るまでの工程、TransformerのAttention、回答を作る2段階の計算を追います。',
    outcome: 'AI・機械学習・LLM・Transformerの関係と、回答が組み立てられる流れを説明できる。',
    prerequisite: '前提知識は不要です。第1章から順に読めます。',
    pages: [
      { id: '01/01-what-is-ai', reason: 'AI・機械学習・LLMがそれぞれ何を指すかを分ける' },
      { id: '04/01-pipeline', reason: '入力が処理され、文章が返るまでの工程を追う' },
      { id: '06/02-attention', reason: 'Transformerが文中のどの語を参照しているかを読む' },
      { id: '08/01-prefill-decode', reason: '回答を作る2段階の計算と、その費用の違いを押さえる' },
    ],
  },
  {
    id: 'use', label: '生成AIを使い始めたい方', title: 'まず、一つの仕事で試す',
    description: '依頼の書き方と、返ってきた内容の確かめ方を押さえます。',
    outcome: '資料を渡して下書きを頼み、原文と照合して使える。',
    prerequisite: '前提知識は不要です。生成AIのアカウントがあれば、本文の手順をそのまま試せます。',
    pages: [
      { id: '01/03-generative-ai', reason: '生成AIができることと、保証しないことを知る' },
      { id: '10/01-instructions', reason: '目的・材料・形式をそろえて依頼する' },
      { id: '09/01-hallucination', reason: '自然な文章に含まれる誤りを見つける' },
      { id: '21/02-security', reason: '入力する情報と、許す操作を確認する' },
    ],
  },
  {
    id: 'read', label: 'モデルや製品を選びたい方', title: 'モデルと製品を、同じ条件で比較する',
    description: 'モデルとアプリの区別から始め、製品の層、性能を測った条件、月額プランの枠までを並べて読みます。',
    outcome: '比較表の数値が、どのモデルをどの条件で測ったものかを質問できる。',
    prerequisite: '前提知識は不要です。用語辞典を並べて読むと、用語の区別をその場で確認できます。',
    pages: [
      { id: '04/03-model-service', reason: 'モデルと、アプリやサービスを区別する' },
      { id: '23/01-five-layers', reason: '製品をモデル・アプリ・提供元などの層に分けて見る' },
      { id: '18/02-benchmarks', reason: '性能の数字に付いている測定条件を読む' },
      { id: '25/01-plan-limits', reason: '月額プランの利用上限と追加費用を確認する' },
    ],
  },
  {
    id: 'decide', label: '社内導入を判断する方', title: '効果・費用・運用を確かめる',
    description: '対象の仕事を絞り、試験導入で何を測り、誰が運用するかを決めます。',
    outcome: '導入判断の確認シートに、条件・担当・未確認事項を残せる。',
    prerequisite: '社内の情報システム・セキュリティ担当との相談を前提にします。',
    pages: [
      { id: '20/01-task-fit', reason: 'AIに任せる工程を決める' },
      { id: '21/01-evaluation-design', reason: '実際の仕事で品質を測る' },
      { id: '25/02-cost-sheet', reason: '利用量と確認作業を含めて費用を比べる' },
      { id: '21/03-operations', reason: '更新・停止・問い合わせの担当を決める' },
    ],
  },
  {
    id: 'build', label: 'AIエージェントを開発したい方', title: 'CLIエージェントで実装し、変更を検証する',
    description: 'CLIコーディングエージェントを同じ題材で試し、モデルの外側の設計、サブエージェントへの分担、検査用のSkillの作り方を扱います。',
    outcome: 'エージェントに任せた変更を、差分とテストで自分で確認できる。',
    prerequisite: 'ターミナルでコマンドを実行し、Gitで差分とコミットを確認できること。',
    pages: [
      { id: '27/01-three-clis', reason: '三つのCLIを同じ手順で動かし、操作と出力を比べる' },
      { id: '12/02-harness', reason: 'モデルの外側で決める設定が、結果をどう変えるかを読む' },
      { id: '30/02-roles-and-subagents', reason: '調査・実装・レビューを役割ごとに分けて実行する' },
      { id: '29/02-inspection-skill', reason: '出力を検査するSkillを作り、確認を手順に組み込む' },
    ],
  },
] as const;

export const optionalTechnicalChapters = new Set(['03', '06', '07', '08', '13', '15', '16', '17', '19', '27', '28', '29', '30', '31', '32']);

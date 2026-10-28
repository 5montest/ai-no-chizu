export const readingPaths = [
  {
    id: 'use', label: '業務で使い始めた方', title: 'まず、一つの仕事で試す',
    description: '依頼の書き方と、返ってきた内容の確かめ方を押さえます。',
    outcome: '資料を渡して下書きを頼み、原文と照合して使える。',
    pages: [
      { id: '01/03-generative-ai', reason: '生成AIができることと、保証しないことを知る' },
      { id: '10/01-instructions', reason: '目的・材料・形式をそろえて依頼する' },
      { id: '09/01-hallucination', reason: '自然な文章に含まれる誤りを見つける' },
      { id: '21/02-security', reason: '入力する情報と、許す操作を確認する' },
    ],
  },
  {
    id: 'read', label: 'AIの提案を読む方', title: '用語を分けて、提案を読む',
    description: 'モデル・製品・検索・エージェントの違いを、提案を読む判断材料にします。',
    outcome: '何の機能を提案され、どの条件で性能を比べたのか質問できる。',
    pages: [
      { id: '04/03-model-service', reason: 'モデルと、アプリやサービスを区別する' },
      { id: '11/01-rag-basics', reason: '社内文書を検索して答える仕組みを知る' },
      { id: '12/01-agent-loop', reason: 'エージェントが作業を進める流れを知る' },
      { id: '18/02-benchmarks', reason: '性能の数字に付いている条件を読む' },
    ],
  },
  {
    id: 'decide', label: '社内導入を判断する方', title: '効果・費用・運用を確かめる',
    description: '対象の仕事を絞り、試験導入で何を測り、誰が運用するかを決めます。',
    outcome: '導入判断の確認シートに、条件・担当・未確認事項を残せる。',
    pages: [
      { id: '20/01-task-fit', reason: 'AIに任せる工程を決める' },
      { id: '21/01-evaluation-design', reason: '実際の仕事で品質を測る' },
      { id: '25/02-cost-sheet', reason: '利用量と確認作業を含めて費用を比べる' },
      { id: '21/03-operations', reason: '更新・停止・問い合わせの担当を決める' },
    ],
  },
] as const;

export const optionalTechnicalChapters = new Set(['03', '06', '07', '08', '13', '15', '16', '17', '19', '27', '28', '29', '30', '31', '32']);

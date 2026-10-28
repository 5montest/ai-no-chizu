# 追加したGPT画像（2026-10-28）

8点の原本を作業フォルダへ保存し、サイトにはWebPで配置した。生成後に、文字と図の関係を目視で確認した。

サイト内の代替テキストとキャプションは src/data/guide-images.ts で管理する。

## 生成プロンプト

```json
[
  {
    "key": "learning-inference",
    "prompt": "Use case: infographic-diagram. Asset type: Japanese AI learning website infographic for adult office workers, no programming assumed. Landscape 3:2, pure white, navy text, blue #0b5fa5, sage green, warm amber accents. Crisp flat editorial illustrations, ample whitespace, large accurate Japanese sans-serif labels. No brands, no robot faces, no tiny explanatory paragraphs, no fabricated empirical statistics. Heading exact \"学習と推論は、別の工程\". Two large rows. Upper \"学習\" shows \"データと正解\" document examples -> \"予測と正解を比べる\" balance/checklist -> \"重みを調整\" chip and adjustment slider -> \"学習済みモデル\". Circular feedback arrow repeats compare/update only. Lower \"推論\" shows \"新しい入力\" -> \"学習済みモデル\" identical finished chip -> \"予測・回答\". Label under lower model \"通常、この処理では重みを更新しない\". Bottom exact \"会話の履歴を参照することと、モデルを追加学習することは違う\". Illustrate conceptual distinction, not a guarantee that provider never later trains on submitted data.",
    "path": "/home/maeda/.codex/generated_images/01a1812b-8b0e-7911-a98b-709ab0549848/exec-a016cc5a-714a-4fdb-a9a3-97ad253d35c7.png"
  },
  {
    "key": "context-memory",
    "prompt": "Use case: infographic-diagram. Asset type: Japanese AI learning website infographic for adult office workers, no programming assumed. Landscape 3:2, pure white, navy text, blue #0b5fa5, sage green, warm amber accents. Crisp flat editorial illustrations, ample whitespace, large accurate Japanese sans-serif labels. No brands, no robot faces, no tiny explanatory paragraphs, no fabricated empirical statistics. Heading exact \"いま読める情報と、保存される情報を分ける\". Three distinct illustrated zones: \"今回の入力\" a working document containing \"指示\" \"会話の履歴\" \"参考資料\" -> model chip \"今回の応答に使う\". Separate archive cabinet \"履歴・メモリ\" with note \"必要な情報を取り出して入力に含める\", arrow from archive to input (no arrow writing model weights). Third training example documents -> distinct chip adjustment labeled \"追加学習\" and \"モデルの重みを変える\". Bottom exact \"コンテキストの上限は、一度の処理で扱える量\". Avoid implying unlimited memory, no forgetting guarantees, no exact token limits. Clearly distinguish product memory from training.",
    "path": "/home/maeda/.codex/generated_images/01a1812b-8b0e-7911-a98b-709ab0549848/exec-a9ea47d3-8c88-4e53-8740-aba7c91160b6.png"
  },
  {
    "key": "evaluation-errors",
    "prompt": "Use case: infographic-diagram. Asset type: Japanese AI learning website infographic for adult office workers, no programming assumed. Landscape 3:2, pure white, navy text, blue #0b5fa5, sage green, warm amber accents. Crisp flat editorial illustrations, ample whitespace, large accurate Japanese sans-serif labels. No brands, no robot faces, no tiny explanatory paragraphs, no fabricated empirical statistics. Heading exact \"見落としと、誤った検出を分けて数える\". Use business example classification \"対応が必要な問い合わせを探す\". Big clear 2-by-2 confusion matrix. Column titles \"実際に必要\" and \"実際は不要\". Row labels \"AIが必要と判定\" and \"AIが不要と判定\". Cells upper left green \"正しく検出\"; upper right amber \"誤った検出\"; lower left amber \"見落とし\"; lower right green \"正しく除外\". Below two large definition cards exact \"適合率：検出した中で正しかった割合\" and \"再現率：必要なものを見つけられた割合\". Bottom exact \"見落としと誤検出の影響は、用途によって違う\". No numeric percentages or unmeasured claims. Matrix orientation and labels must be mathematically consistent.",
    "path": "/home/maeda/.codex/generated_images/01a1812b-8b0e-7911-a98b-709ab0549848/exec-be71cdd8-bac9-4789-9cb7-44851d161cfc.png"
  },
  {
    "key": "multimodal-business",
    "prompt": "Use case: infographic-diagram. Asset type: Japanese AI learning website infographic for adult office workers, no programming assumed. Landscape 3:2, pure white, navy text, blue #0b5fa5, sage green, warm amber accents. Crisp flat editorial illustrations, ample whitespace, large accurate Japanese sans-serif labels. No brands, no robot faces, no tiny explanatory paragraphs, no fabricated empirical statistics. Heading exact \"入力できる種類と、出力できる種類は別\". On left office artifacts three big labeled cards \"文章\" document, \"画像\" photo/report chart, \"音声\" waveform mic. Arrows entering central blue box \"対応するモデル・処理\". On right three separate clear output possibilities \"文章で答える\" chat bubble, \"画像を作る\" picture, \"音声で返す\" speaker. Not all-to-all dedicated links, show only central arrows. Bottom prominent exact \"画像を読めても、画像を作れるとは限らない\". Small secondary note \"対応範囲は、モデルとアプリごとに確認\". Do not use decorative matrix implying support, no product names.",
    "path": "/home/maeda/.codex/generated_images/01a1812b-8b0e-7911-a98b-709ab0549848/exec-b2456857-9851-4661-af73-398b94c890b0.png"
  },
  {
    "key": "cost-contract",
    "prompt": "Use case: infographic-diagram. Japanese educational website illustration for office workers. Landscape 3:2, white background, navy Japanese sans-serif large text, blue #0b5fa5, sage green, warm amber. Spacious flat editorial style matching a modern textbook. No brands or invented statistics, no tiny text. Heading exact \"月額料金と、使った分の料金を分ける\". Three clearly separated columns: \"アプリの月額プラン\" with person and subscription calendar icon, labels \"席数・月額・利用上限\"; \"APIの従量課金\" with request/answer meter icons, labels \"入力・出力・呼び出し量\"; \"運用の費用\" with reviewer and toolbox icons, labels \"確認・修正・検索・保存\". All arrows down to row \"同じ仕事を、同じ量だけ行う条件で比べる\". Bottom exact \"月額プランの利用枠を、そのままAPI単価に換算しない\". Icons communicate distinct billing units without showing prices.",
    "path": "/home/maeda/.codex/generated_images/01a1812b-8b0e-7911-a98b-709ab0549848/exec-0366ebbd-48d0-4e91-908c-ad59be616209.png"
  },
  {
    "key": "local-memory",
    "prompt": "Use case: infographic-diagram. Japanese educational website illustration for office workers. Landscape 3:2, white background, navy Japanese sans-serif large text, blue #0b5fa5, sage green, warm amber. Spacious flat editorial style matching a modern textbook. No brands or invented statistics, no tiny text. Heading exact \"モデルの重みだけでは、必要メモリは決まらない\". Big illustration of a memory tray with three distinct blocks \"モデルの重み\" chip, \"文脈のキャッシュ\" stacked conversation files, \"実行用の領域\" gears. Under each, short sublabels respectively \"パラメータ数と保存精度\" / \"入力の長さと同時処理数\" / \"実行するソフトと設定\". Below a small comparison same chip shown full precision and reduced precision, exact label \"量子化：数値の表現を粗くして容量を減らす\". Bottom exact \"容量・速度・品質は、実際の構成で確かめる\". No numbers or implication that quantization always speeds up or always preserves accuracy.",
    "path": "/home/maeda/.codex/generated_images/01a1812b-8b0e-7911-a98b-709ab0549848/exec-09ef0303-feb8-4644-b659-71d1d659cb4a.png"
  },
  {
    "key": "extension-layers",
    "prompt": "Use case: infographic-diagram. Japanese educational website illustration for office workers. Landscape 3:2, white background, navy Japanese sans-serif large text, blue #0b5fa5, sage green, warm amber. Spacious flat editorial style matching a modern textbook. No brands or invented statistics, no tiny text. Heading exact \"拡張の名前を、役割で分ける\". Central application box labeled \"AIを動かすアプリ\". Four separate cards connected to it: \"指示ファイル\" document with label \"作業全体の前提\", \"Skill\" checklist with label \"仕事の手順\", \"MCP\" plug with label \"ツールなどへの接続規格\", \"Hook\" clock/lightning with label \"決まった時点の処理\". A separate package icon \"Plugin\" has dotted arrows toward Skill MCP Hook and note \"機能や設定をまとめて配布\". Bottom exact \"呼び名や含まれる機能は、製品ごとに確かめる\". Do not imply every Plugin must contain all components or that MCP is itself authorization.",
    "path": "/home/maeda/.codex/generated_images/01a1812b-8b0e-7911-a98b-709ab0549848/exec-b07b6748-34d3-48a7-b513-9f92a85fc3d8.png"
  },
  {
    "key": "document-verification",
    "prompt": "Use case: infographic-diagram. Japanese educational website illustration for office workers. Landscape 3:2, white background, navy Japanese sans-serif large text, blue #0b5fa5, sage green, warm amber. Spacious flat editorial style matching a modern textbook. No brands or invented statistics, no tiny text. Heading exact \"読めた内容を、原本と照らして使う\". Three large illustrated panels sequentially connected: \"1 資料を渡す\" PDF document showing text/table/chart, \"2 内容を抽出\" a structured form with blank fields and source page references, \"3 原本と照合\" a human checking highlighted cell values against original document. Below verification a branch \"読めない・根拠がない\" -> amber box \"不明と記録して、人へ渡す\". Bottom exact \"読み取りの成功と、業務判断の正しさは別\". No promise OCR is perfect, no invented sensitive information or specific provider limits.",
    "path": "/home/maeda/.codex/generated_images/01a1812b-8b0e-7911-a98b-709ab0549848/exec-86d8a28b-e682-47eb-81ea-54afc53096ed.png"
  }
]
```
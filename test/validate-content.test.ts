import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * scripts/validate-content.mjs の検査が本当に効いているかを見るテスト。
 *
 * 本物の記事が対象だと「問題がない」ことしか確かめられず、
 * 検査そのものが壊れていても気づけない。小さな見本を組んで、
 * わざと壊したときに止まるかを確かめる。
 */

const SCRIPT = fileURLToPath(new URL('../scripts/validate-content.mjs', import.meta.url));

type Fixture = {
  quiz: { answer: number };
  glossary?: string[];
  diagramTag?: string;
  sources?: string[];
};

function writeFixture(
  root: string,
  {
    quiz,
    glossary = ['ai'],
    diagramTag = '<Diagram name="ai-map" />',
    sources = [],
  }: Fixture,
) {
  fs.mkdirSync(path.join(root, 'src/data'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src/content/chapters/01'), { recursive: true });

  fs.writeFileSync(
    path.join(root, 'src/data/curriculum.json'),
    JSON.stringify({
      chapters: [{ id: '01', status: 'published', title: '第1章', shortTitle: '第1章' }],
    }),
  );
  fs.writeFileSync(
    path.join(root, 'src/data/glossary.json'),
    JSON.stringify({
      categories: [{ id: 'basic', label: '基本' }],
      terms: [
        {
          slug: 'ai',
          term: 'AI',
          short: '説明',
          category: 'basic',
          chapters: ['01'],
          related: [],
        },
      ],
    }),
  );
  fs.writeFileSync(
    path.join(root, 'src/data/diagrams.ts'),
    `export const diagrams = {
  'ai-map': { number: '1-1', title: '見本の図', caption: '概念図。数値は例示。', code: 'graph TD;A-->B' },
};
`,
  );

  const frontmatter = [
    '---',
    'chapter: "01"',
    'title: 見本の記事',
    'description: 説明',
    'section: 基本',
    'order: 1',
    'level: intro',
    'readingMinutes: 3',
    'updated: "2026-10-28"',
    `glossary: [${glossary.map((slug) => JSON.stringify(slug)).join(', ')}]`,
    'summary:',
    '  - 一つ目',
    '  - 二つ目',
    '  - 三つ目',
    'quiz:',
    '  - question: 問い',
    '    options:',
    '      - あ',
    '      - い',
    `    answer: ${quiz.answer}`,
    '    explanation: 解説',
    ...(sources.length ? ['sources:', ...sources] : []),
    '---',
    '',
    `本文です。${diagramTag} [[${glossary[0]}]]`,
    '',
  ].join('\n');

  fs.writeFileSync(path.join(root, 'src/content/chapters/01/sample.mdx'), frontmatter);
}

function runValidator(root: string) {
  // 成功時にも警告が stderr に出るので、両方を必ず受け取る。
  const result = spawnSync(process.execPath, [SCRIPT, '--root', root], {
    encoding: 'utf8',
  });
  return {
    code: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function withFixture(options: Fixture, fn: (root: string) => void) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chizu-content-'));
  try {
    writeFixture(root, options);
    fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('正しい見本は通る', () => {
  withFixture({ quiz: { answer: 1 } }, (root) => {
    const result = runValidator(root);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /コンテンツ検証OK/);
  });
});

test('正解番号が選択肢の数以上なら止まる', () => {
  withFixture({ quiz: { answer: 2 } }, (root) => {
    const result = runValidator(root);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /answer=2 は選択肢の範囲外/);
  });
});

test('未登録の用語参照は止まる', () => {
  withFixture({ quiz: { answer: 0 }, glossary: ['unknown-term'] }, (root) => {
    const result = runValidator(root);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /用語辞典に「unknown-term」がありません/);
  });
});

test('未登録の図の参照は止まる', () => {
  withFixture({ quiz: { answer: 0 }, diagramTag: '<Diagram name="no-such-diagram" />' }, (root) => {
    const result = runValidator(root);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /diagrams\.ts にありません/);
  });
});

test('図の但し書きが空なら止まる', () => {
  withFixture({ quiz: { answer: 0 } }, (root) => {
    const file = path.join(root, 'src/data/diagrams.ts');
    fs.writeFileSync(
      file,
      `export const diagrams = {
  'ai-map': { number: '1-1', title: '見本の図', caption: '', code: 'graph TD;A-->B' },
};
`,
    );
    const result = runValidator(root);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /caption が空です/);
  });
});

test('URL のない出典に説明がなければ止まる', () => {
  withFixture(
    {
      quiz: { answer: 0 },
      sources: ["  - title: '見本の本'", "    publisher: '出版社'"],
    },
    (root) => {
      const result = runValidator(root);
      assert.equal(result.code, 1);
      assert.match(result.stderr, /URL がない場合は note に理由を書いてください/);
    },
  );
});

test('https でない出典は警告だけにして、検証は通す', () => {
  withFixture(
    {
      quiz: { answer: 0 },
      sources: [
        "  - title: '見本の記事'",
        "    url: 'http://example.com/page'",
        "    note: 'https で開けないため http のまま示す。'",
      ],
    },
    (root) => {
      const result = runValidator(root);
      assert.equal(result.code, 0, result.stderr);
      assert.match(result.stderr, /http の URL です/);
    },
  );
});

test('同じ URL を使い回した出典は止まる', () => {
  withFixture(
    {
      quiz: { answer: 0 },
      sources: [
        "  - title: '見本の記事'",
        "    url: 'https://example.com/page'",
        "  - title: '同じ記事'",
        "    url: 'https://example.com/page'",
      ],
    },
    (root) => {
      const result = runValidator(root);
      assert.equal(result.code, 1);
      assert.match(result.stderr, /同じ URL が sources\[0\] と重複しています/);
    },
  );
});

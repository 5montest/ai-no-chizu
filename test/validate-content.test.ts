import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
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

type Fixture = { quiz: { answer: number }; glossary?: string[]; diagramTag?: string };

function writeFixture(
  root: string,
  { quiz, glossary = ['ai'], diagramTag = '<Diagram name="ai-map" />' }: Fixture,
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
    '---',
    '',
    `本文です。${diagramTag} [[${glossary[0]}]]`,
    '',
  ].join('\n');

  fs.writeFileSync(path.join(root, 'src/content/chapters/01/sample.mdx'), frontmatter);
}

function runValidator(root: string) {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, '--root', root], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, stdout, stderr: '' };
  } catch (error) {
    // execFileSync の失敗（終了コード1）は例外で届く。中身は Node の決まった形。
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { code: failure.status ?? 1, stdout: failure.stdout ?? '', stderr: failure.stderr ?? '' };
  }
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

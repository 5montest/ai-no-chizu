import assert from 'node:assert/strict';
import test from 'node:test';
import { letterFor, mountQuiz, optionOrder, shuffled } from '../src/lib/quiz-client.ts';
import type { QuizQuestion } from '../src/lib/quiz-client.ts';

/**
 * クイズの表示ロジックのテスト。
 *
 * MDX の正解データはすべて answer: 0 のままなので、表示時に選択肢を並べ替えないと
 * 正解の位置が常に A になる。ここでは「並べ替えても採点と解説がずれない」ことを
 * DOM 抜きで確かめられるように、最小限の DOM 代用を用意して実際の mountQuiz を動かす。
 */

class FakeText {
  textContent: string;
  constructor(text: string) {
    this.textContent = text;
  }
}

class FakeElement {
  tag: string;
  classes = new Set<string>();
  children: Array<FakeElement | FakeText> = [];
  dataset: Record<string, string> = {};
  attributes: Record<string, string> = {};
  listeners: Record<string, Array<(event?: unknown) => void>> = {};
  textContent = '';
  hidden = false;
  disabled = false;
  type = '';
  id = '';

  constructor(tag = 'div') {
    this.tag = tag;
  }

  get className(): string {
    return [...this.classes].join(' ');
  }

  set className(value: string) {
    this.classes = new Set(value.split(/\s+/).filter(Boolean));
  }

  get classList() {
    const set = this.classes;
    return {
      add: (...names: string[]) => names.forEach((name) => set.add(name)),
      remove: (...names: string[]) => names.forEach((name) => set.delete(name)),
      contains: (name: string) => set.has(name),
      toggle: (name: string, force?: boolean) => {
        const on = force ?? !set.has(name);
        if (on) set.add(name);
        else set.delete(name);
        return on;
      },
    };
  }

  append(...nodes: Array<FakeElement | FakeText | string>) {
    for (const node of nodes) {
      this.children.push(typeof node === 'string' ? new FakeText(node) : node);
    }
  }

  replaceChildren(...nodes: Array<FakeElement | FakeText | string>) {
    this.children = [];
    this.append(...nodes);
  }

  before() {}
  setAttribute(name: string, value: string) {
    this.attributes[name] = String(value);
  }
  getAttribute(name: string) {
    return this.attributes[name] ?? null;
  }
  removeAttribute(name: string) {
    delete this.attributes[name];
  }
  addEventListener(type: string, fn: (event?: unknown) => void) {
    (this.listeners[type] ??= []).push(fn);
  }
  click() {
    for (const fn of this.listeners.click ?? []) fn({ target: this });
  }
  focus() {}

  private matches(selector: string): boolean {
    if (selector.startsWith('.')) return this.classes.has(selector.slice(1));
    if (selector.startsWith('[') && selector.endsWith(']')) {
      return selector.slice(1, -1) in this.attributes;
    }
    throw new Error(`テスト用の querySelector が対応していない指定です: ${selector}`);
  }

  private collect(selector: string, out: FakeElement[]) {
    for (const child of this.children) {
      if (!(child instanceof FakeElement)) continue;
      if (child.matches(selector)) out.push(child);
      child.collect(selector, out);
    }
  }

  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const out: FakeElement[] = [];
    this.collect(selector, out);
    return out;
  }

  /** 子要素のテキストをつなげたもの（子は span などを想定）。 */
  get text(): string {
    return this.children.map((child) => child.textContent).join('');
  }
}

globalThis.document = {
  createElement: (tag: string) => new FakeElement(tag),
  createTextNode: (text: string) => new FakeText(text),
} as unknown as Document;

type Mounted = {
  root: FakeElement;
  body: FakeElement;
  buttons: () => FakeElement[];
  /** 表示順。中身は「元の選択肢番号」。 */
  order: () => number[];
  /** 画面に出ている記号（A, B, …）。 */
  letters: () => string[];
  clickOption: (find: (text: string) => boolean) => void;
  explanation: () => string;
  next: () => FakeElement;
  retry: () => FakeElement;
};

function mount(questions: QuizQuestion[], random: () => number): Mounted {
  const root = new FakeElement('div');
  const body = new FakeElement('div');
  body.setAttribute('data-quiz-body', '');
  const counter = new FakeElement('span');
  counter.setAttribute('data-quiz-counter', '');
  root.append(body, counter);

  mountQuiz(root as unknown as HTMLElement, questions, { random });

  const buttons = () =>
    body.querySelectorAll('.quiz__option');

  return {
    root,
    body,
    buttons,
    order: () => buttons().map((b) => Number(b.dataset.choice)),
    letters: () => buttons().map((b) => b.children[0].textContent),
    clickOption: (find) => {
      const button = buttons().find((b) => find(b.children[1].textContent));
      assert.ok(button, 'クリック対象の選択肢が見つかりませんでした');
      button.click();
    },
    explanation: () => body.querySelector('.quiz__explain')?.text ?? '',
    next: () => {
      const el = body.querySelector('.quiz__next');
      assert.ok(el, '.quiz__next がありません');
      return el;
    },
    retry: () => {
      const el = body.querySelector('.quiz__next');
      assert.ok(el, '再挑戦ボタンがありません');
      return el;
    },
  };
}

/** 再現性のある乱数。テストの並び順を固定するために使う。 */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const QUESTION: QuizQuestion = {
  question: 'テスト用の設問',
  options: ['正解の選択肢', 'まちがい1', 'まちがい2', 'まちがい3'],
  answer: 0,
  explanation: '解説です。',
};

test('optionOrder は並べ替えても元の番号を一度ずつ含む', () => {
  for (let seed = 1; seed <= 50; seed += 1) {
    const order = optionOrder(4, lcg(seed));
    assert.deepEqual([...order].sort(), [0, 1, 2, 3]);
  }
});

test('optionOrder で正解の表示位置は A に固定されない', () => {
  const positions = new Set<number>();
  const letters = new Set<string>();
  for (let seed = 1; seed <= 200; seed += 1) {
    const order = optionOrder(QUESTION.options.length, lcg(seed));
    const position = order.indexOf(QUESTION.answer);
    positions.add(position);
    letters.add(letterFor(order, QUESTION.answer));
  }
  assert.ok(positions.size > 1, '正解の位置が 1 か所に固定されている');
  assert.deepEqual([...letters].sort(), ['A', 'B', 'C', 'D']);
});

test('letterFor は表示位置の記号を返す', () => {
  assert.equal(letterFor([2, 0, 1, 3], 0), 'B');
  assert.equal(letterFor([2, 0, 1, 3], 2), 'A');
  assert.equal(letterFor([3], 3), 'A');
});

test('並べ替えても、正解の選択肢を選べば正解になる', () => {
  for (let seed = 1; seed <= 40; seed += 1) {
    const quiz = mount([QUESTION], lcg(seed));
    quiz.clickOption((text) => text === QUESTION.options[QUESTION.answer]);
    assert.match(quiz.explanation(), /^正解。/);
  }
});

test('不正解のときの解説は、画面に出ている正解の記号を指す', () => {
  for (let seed = 1; seed <= 40; seed += 1) {
    const quiz = mount([QUESTION], lcg(seed));
    const shown = new Map(quiz.buttons().map((b, i) => [b.children[1].textContent, quiz.letters()[i]]));
    quiz.clickOption((text) => text === 'まちがい2');
    const expected = shown.get(QUESTION.options[QUESTION.answer]);
    assert.equal(quiz.explanation(), `不正解。正解は ${expected}。解説です。`);
  }
});

test('正解の選択肢に is-correct が付き、選んだ誤答に is-wrong が付く', () => {
  const quiz = mount([QUESTION], lcg(7));
  quiz.clickOption((text) => text === 'まちがい1');
  const marked = quiz
    .buttons()
    .filter((b) => b.classList.contains('is-correct'))
    .map((b) => b.children[1].textContent);
  const wrong = quiz
    .buttons()
    .filter((b) => b.classList.contains('is-wrong'))
    .map((b) => b.children[1].textContent);
  assert.deepEqual(marked, [QUESTION.options[QUESTION.answer]]);
  assert.deepEqual(wrong, ['まちがい1']);
});

test('再挑戦すると選択肢が並べ直される', () => {
  const questions: QuizQuestion[] = [
    QUESTION,
    { ...QUESTION, question: '2問目' },
  ];
  const quiz = mount(questions, lcg(3));
  const first = quiz.order();

  for (const q of questions) {
    void q;
    quiz.clickOption((text) => text === QUESTION.options[QUESTION.answer]);
    quiz.next().click();
  }
  // 結果画面の「もう一度挑戦する」で最初の設問に戻る。
  quiz.retry().click();
  const second = quiz.order();

  assert.deepEqual([...second].sort(), [0, 1, 2, 3]);
  assert.notDeepEqual(second, first, '再挑戦しても並び順が変わっていない');
});

test('shuffled は元の配列を書き換えない', () => {
  const source = ['a', 'b', 'c', 'd'];
  const result = shuffled(source, lcg(11));
  assert.deepEqual(source, ['a', 'b', 'c', 'd']);
  assert.deepEqual([...result].sort(), ['a', 'b', 'c', 'd']);
});

export type QuizQuestion = {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  /** 解説のあとに出す復習リンク先。出題元のページ。 */
  pageUrl?: string;
  /** 復習リンクの表示名（例：第6章「Attention」）。 */
  pageLabel?: string;
};

type Options = {
  shuffleQuestions?: boolean;
  /** 選択肢の並び替えに使う乱数。テストから固定できるようにしてある。 */
  random?: () => number;
  onFinish?: (score: number, total: number) => void;
  /** 再挑戦のときに、出題範囲のプールから問題を選び直す。返した配列で次の5問を組む。 */
  onRetry?: () => QuizQuestion[];
};

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function shuffled<T>(items: T[], random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * 選択肢の表示順を決める。返り値は「表示位置 → 元の選択肢番号」。
 *
 * 正解の位置が固定されると、内容を読まずに A を選ぶだけで点が取れてしまう。
 * 正解データ（MDX の answer）はそのままにし、表示のときだけ並べ替える。
 */
export function optionOrder(count: number, random: () => number = Math.random): number[] {
  return shuffled(
    Array.from({ length: count }, (_, i) => i),
    random,
  );
}

/** 元の選択肢番号から、画面上の記号（A, B, …）を引く。 */
export function letterFor(order: number[], originalIndex: number): string {
  const position = order.indexOf(originalIndex);
  return LETTERS[position] || String(position + 1);
}

/**
 * .quiz 要素の中に、1問ずつ回答するインターフェースを組み立てる。
 * 回答すると正誤と解説がその場で展開し、最後にスコアを表示する。
 */
export function mountQuiz(root: HTMLElement, questions: QuizQuestion[], options: Options = {}) {
  // 有無は下の if で実行時に確かめる。型の上では「ある」と決めておく。
  const body = root.querySelector<HTMLElement>('[data-quiz-body]')!;
  const counter = root.querySelector<HTMLElement>('[data-quiz-counter]');
  if (!body || questions.length === 0) return;

  const random = options.random ?? Math.random;
  let list = options.shuffleQuestions ? shuffled(questions, random) : [...questions];
  let total = list.length;
  let index = 0;
  let score = 0;
  let answered = false;
  let order: number[] = [];

  function updateCounter() {
    if (!counter) return;
    counter.textContent = index < total ? `${index + 1} / ${total}` : `${total} / ${total}`;
  }

  function renderQuestion() {
    answered = false;
    updateCounter();
    const q = list[index];
    // 出題のたびに（再挑戦でも）並べ直す。
    order = optionOrder(q.options.length, random);
    body.replaceChildren();

    const progress = document.createElement('div');
    progress.className = 'quiz__progress';
    progress.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < total; i += 1) {
      const dot = document.createElement('span');
      dot.className = 'quiz__dot';
      if (i < index) dot.classList.add('is-done');
      if (i === index) dot.classList.add('is-current');
      progress.append(dot);
    }

    const question = document.createElement('p');
    question.className = 'quiz__question';
    question.textContent = q.question;

    const optionList = document.createElement('ul');
    optionList.className = 'quiz__options';

    const buttons: HTMLButtonElement[] = [];
    order.forEach((originalIndex, displayIndex) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quiz__option';
      button.dataset.choice = String(originalIndex);
      const letter = document.createElement('span');
      letter.className = 'opt-letter';
      letter.textContent = LETTERS[displayIndex] || String(displayIndex + 1);
      const text = document.createElement('span');
      text.textContent = q.options[originalIndex];
      button.append(letter, text);
      button.addEventListener('click', () => choose(originalIndex, buttons));
      buttons.push(button);
      li.append(button);
      optionList.append(li);
    });

    const explain = document.createElement('p');
    explain.className = 'quiz__explain';
    explain.hidden = true;
    explain.setAttribute('role', 'status');

    const foot = document.createElement('div');
    foot.className = 'quiz__foot';
    const scoreEl = document.createElement('span');
    scoreEl.className = 'quiz__score';
    scoreEl.hidden = true;
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'quiz__next';
    next.textContent = index === total - 1 ? '結果を見る' : '次の問題へ';
    next.hidden = true;
    next.addEventListener('click', () => {
      index += 1;
      if (index < total) renderQuestion();
      else renderDone();
    });
    foot.append(scoreEl, next);

    body.append(progress, question, optionList, explain, foot);
  }

  function choose(choice: number, buttons: HTMLButtonElement[]) {
    if (answered) return;
    answered = true;
    const q = list[index];
    const correct = choice === q.answer;
    if (correct) score += 1;

    buttons.forEach((button) => {
      button.disabled = true;
      const original = Number(button.dataset.choice);
      if (original === q.answer) button.classList.add('is-correct');
      if (original === choice && !correct) button.classList.add('is-wrong');
    });

    const explain = body.querySelector<HTMLElement>('.quiz__explain');
    if (explain) {
      explain.hidden = false;
      const strong = document.createElement('strong');
      // 正解の記号は、並べ替えたあとの表示位置から引く。
      strong.textContent = correct ? '正解。' : `不正解。正解は ${letterFor(order, q.answer)}。`;
      explain.append(strong, document.createTextNode(q.explanation));
      // 間違えた問題を、その場で出題元のページへ戻って確認できるようにする。
      if (q.pageUrl) {
        const link = document.createElement('a');
        link.className = 'quiz__explain-link';
        link.href = q.pageUrl;
        link.textContent = `→ ${q.pageLabel ?? 'この問題のページ'}を読む`;
        explain.append(document.createElement('br'), link);
      }
    }

    const scoreEl = body.querySelector<HTMLElement>('.quiz__score');
    if (scoreEl) {
      scoreEl.hidden = false;
      scoreEl.textContent = `${index + 1}問中${score}問正解`;
    }
    updateCounter();
    const next = body.querySelector<HTMLButtonElement>('.quiz__next');
    if (next) {
      next.hidden = false;
      next.focus({ preventScroll: true });
    }
  }

  function renderDone() {
    updateCounter();
    body.replaceChildren();
    const done = document.createElement('div');
    done.className = 'quiz__done';
    const message = document.createElement('p');
    message.textContent =
      score === total
        ? '全問正解です。要点はつかめています。'
        : score >= Math.ceil(total * 0.6)
          ? 'おおむね理解できています。解説を読み返して、言葉の定義を確認しましょう。'
          : 'もう一度、本文の図と用語の定義に戻ってみましょう。';
    const scoreEl = document.createElement('p');
    scoreEl.className = 'quiz__score';
    scoreEl.textContent = `${total}問中${score}問正解`;
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'quiz__next';
    retry.textContent = 'もう一度挑戦する';
    retry.addEventListener('click', () => {
      // 2回目は同じ5問の暗記確認にせず、範囲のプールから選び直す。
      const nextQuestions = options.onRetry?.();
      if (nextQuestions && nextQuestions.length > 0) list = nextQuestions;
      else if (options.shuffleQuestions) list = shuffled(list, random);
      total = list.length;
      index = 0;
      score = 0;
      renderQuestion();
    });
    done.append(message, scoreEl, retry);
    body.append(done);
    options.onFinish?.(score, total);
  }

  renderQuestion();
}

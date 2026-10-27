export type QuizQuestion = {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
};

type Options = {
  shuffleQuestions?: boolean;
  onFinish?: (score: number, total: number) => void;
};

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * .quiz 要素の中に、1問ずつ回答するインターフェースを組み立てる。
 * 回答すると正誤と解説がその場で展開し、最後にスコアを表示する。
 */
export function mountQuiz(root: HTMLElement, questions: QuizQuestion[], options: Options = {}) {
  const body = root.querySelector<HTMLElement>('[data-quiz-body]');
  const counter = root.querySelector<HTMLElement>('[data-quiz-counter]');
  if (!body || questions.length === 0) return;

  const list = options.shuffleQuestions ? shuffled(questions) : [...questions];
  const total = list.length;
  let index = 0;
  let score = 0;
  let answered = false;

  function updateCounter() {
    if (!counter) return;
    counter.textContent = index < total ? `${index + 1} / ${total}` : `${total} / ${total}`;
  }

  function renderQuestion() {
    answered = false;
    updateCounter();
    const q = list[index];
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
    q.options.forEach((label, i) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quiz__option';
      const letter = document.createElement('span');
      letter.className = 'opt-letter';
      letter.textContent = LETTERS[i] || String(i + 1);
      const text = document.createElement('span');
      text.textContent = label;
      button.append(letter, text);
      button.addEventListener('click', () => choose(i, buttons));
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

    buttons.forEach((button, i) => {
      button.disabled = true;
      if (i === q.answer) button.classList.add('is-correct');
      if (i === choice && !correct) button.classList.add('is-wrong');
    });

    const explain = body.querySelector<HTMLElement>('.quiz__explain');
    if (explain) {
      explain.hidden = false;
      const strong = document.createElement('strong');
      strong.textContent = correct ? '正解。' : `不正解。正解は ${LETTERS[q.answer]}。`;
      explain.append(strong, document.createTextNode(q.explanation));
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

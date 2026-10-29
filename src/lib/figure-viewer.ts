export function initFigureViewer() {
  const dialog = document.querySelector<HTMLDialogElement>('[data-figure-viewer]');
  if (!dialog) return;
  const viewport = dialog.querySelector<HTMLElement>('.figure-viewer__viewport')!;
  const content = dialog.querySelector<HTMLElement>('.figure-viewer__content')!;
  const title = dialog.querySelector<HTMLElement>('h2')!;
  let naturalWidth = 0, scale = 1;
  let opener: HTMLElement | null = null;
  const fitScale = () => Math.min(1, Math.max(1, viewport.clientWidth - 32) / naturalWidth);
  const paint = () => {
    content.style.width = `${Math.round(naturalWidth * scale)}px`;
    const image = content.firstElementChild as HTMLElement | null;
    if (image) { image.style.width = '100%'; image.style.maxWidth = 'none'; image.style.height = 'auto'; }
  };
  const fit = () => { scale = fitScale(); paint(); viewport.scrollTo(0, 0); };
  const open = (figure: HTMLElement, trigger: HTMLElement) => {
    const source = figure.querySelector<SVGSVGElement>('svg') ?? figure.querySelector<HTMLImageElement>('img');
    if (!source) return;
    naturalWidth = source instanceof SVGSVGElement ? source.viewBox.baseVal.width : source.naturalWidth;
    if (!naturalWidth) return;
    opener = trigger;
    title.textContent = figure.querySelector('.diagram-plate__title,figcaption > span')?.textContent || '図の拡大';
    const clone = source.cloneNode(true) as SVGSVGElement | HTMLImageElement;
    if (clone instanceof SVGSVGElement) {
      // 同じ文書内で元の図とID・スタイルの参照が衝突しないようにする。
      const ids = [clone, ...clone.querySelectorAll<SVGElement>('[id]')].filter(node => node.id).map(node => node.id).sort((a, b) => b.length - a.length);
      for (const node of [clone, ...clone.querySelectorAll('*')]) {
        for (const attr of [...node.attributes]) {
          let value = attr.value;
          if (attr.name === 'id') value = `viewer-${value}`;
          else if (attr.name.startsWith('aria-')) value = value.split(' ').map(id => ids.includes(id) ? `viewer-${id}` : id).join(' ');
          else for (const id of ids) value = value.replaceAll(`#${id}`, `#viewer-${id}`);
          node.setAttribute(attr.name, value);
        }
      }
      for (const style of clone.querySelectorAll('style')) for (const id of ids) style.textContent = style.textContent!.replaceAll(`#${id}`, `#viewer-${id}`);
    }
    content.replaceChildren(clone);
    dialog.showModal();
    document.documentElement.classList.add('figure-viewer-open');
    fit();
  };
  document.addEventListener('click', event => {
    if (!(event.target instanceof Element) || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const trigger = event.target.closest<HTMLElement>('[data-figure-open], .guide-image__open, .diagram-plate__body');
    if (!trigger) return;
    const figure = trigger.closest<HTMLElement>('figure');
    if (!figure?.querySelector('svg,img')) return;
    event.preventDefault();open(figure, trigger);
  });
  dialog.querySelector('[data-figure-fit]')?.addEventListener('click', fit);
  for (const button of dialog.querySelectorAll<HTMLElement>('[data-figure-zoom]')) button.addEventListener('click', () => {
    scale = Math.max(fitScale(), Math.min(4, scale * (button.dataset.figureZoom === 'in' ? 1.6 : 1 / 1.6)));paint();
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('figure-viewer-open');content.replaceChildren();opener?.focus({ preventScroll: true });
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });
  // 幅変更時は現在の拡大率を保ち、全体表示より小さくなった場合だけ合わせる。
  window.addEventListener('resize', () => { if (dialog.open) { scale = Math.max(scale, fitScale()); paint(); } }, { passive: true });
}

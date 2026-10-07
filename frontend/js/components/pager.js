// "Previous / Page 2 of 5 / Next" buttons. pagerHtml() makes the markup, bindPager() wires the clicks.
export const pagerHtml = (p) => (p.pages > 1
  ? `<nav class="pager" aria-label="Pages"><button type="button" class="btn btn-ghost" data-pg="-1" ${p.page <= 1 ? 'disabled' : ''}>Previous</button><span class="align-self-center px-2">Page ${p.page} of ${p.pages}</span><button type="button" class="btn btn-ghost" data-pg="1" ${p.page >= p.pages ? 'disabled' : ''}>Next</button></nav>`
  : '');

export function bindPager(root, onMove) {
  root.querySelectorAll('[data-pg]').forEach((b) => b.addEventListener('click', () => onMove(Number(b.dataset.pg))));
}

import { esc } from '../core/ui.js';

// A general pop-up. bodyHtml goes inside; the caller wires up buttons using the returned .el.
// Returns { el, body, close }. The pop-up removes itself from the page when it closes.
export function openModal({ title, bodyHtml, footerHtml = '', size = '', onClosed }) {
  const el = document.createElement('div');
  el.className = 'modal fade';
  el.tabIndex = -1;
  el.setAttribute('aria-hidden', 'true');
  const titleId = `modal-title-${Math.random().toString(36).slice(2, 8)}`;
  el.setAttribute('aria-labelledby', titleId);
  el.innerHTML = `
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable ${esc(size)}"><div class="modal-content">
      <div class="modal-header"><h2 class="modal-title h5" id="${titleId}">${esc(title)}</h2>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
    </div></div>`;
  document.body.appendChild(el);
  const modal = new window.bootstrap.Modal(el);
  el.addEventListener('hidden.bs.modal', () => { modal.dispose(); el.remove(); if (onClosed) onClosed(); });
  modal.show();
  return { el, body: el.querySelector('.modal-body'), close: () => modal.hide() };
}

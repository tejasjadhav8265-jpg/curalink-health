import { esc, setLoading } from '../core/ui.js';

// A "Are you sure?" pop-up. onConfirm() returns a promise; if it throws, the message shows inside the pop-up.
export function confirmModal({ title, message, confirmLabel = 'Yes, delete', confirmClass = 'btn-danger', onConfirm }) {
  const el = document.createElement('div');
  el.className = 'modal fade';
  el.tabIndex = -1;
  el.setAttribute('aria-labelledby', 'confirm-title');
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="modal-dialog modal-dialog-centered"><div class="modal-content">
      <div class="modal-header"><h2 class="modal-title h5" id="confirm-title">${esc(title)}</h2>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
      <div class="modal-body"><p class="mb-0">${esc(message)}</p>
        <div class="notice notice-error mt-3" id="confirm-error" role="alert" hidden></div></div>
      <div class="modal-footer">
        <button type="button" class="btn btn-ghost" data-bs-dismiss="modal">Cancel</button>
        <button type="button" class="btn ${esc(confirmClass)}" id="confirm-go">${esc(confirmLabel)}</button>
      </div>
    </div></div>`;
  document.body.appendChild(el);
  const modal = new window.bootstrap.Modal(el);
  const go = el.querySelector('#confirm-go');
  const err = el.querySelector('#confirm-error');
  go.addEventListener('click', async () => {
    err.hidden = true;
    setLoading(go, true, 'Please wait...');
    try { await onConfirm(); modal.hide(); } catch (e) { setLoading(go, false); err.textContent = e.message || 'Something went wrong.'; err.hidden = false; }
  });
  el.addEventListener('hidden.bs.modal', () => { modal.dispose(); el.remove(); });
  modal.show();
}

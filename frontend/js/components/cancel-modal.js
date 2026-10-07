import { esc, setLoading } from '../core/ui.js';

// Opens a "Cancel appointment" pop-up that asks for a reason.
// onConfirm(reason) must return a promise; if it throws, the message is shown inside the pop-up.
export function openCancelModal({
  summary, onConfirm, title = 'Cancel this appointment?', label = 'Reason for cancelling',
  confirmLabel = 'Yes, cancel it', keepLabel = 'Keep appointment', busyLabel = 'Cancelling...',
}) {
  const el = document.createElement('div');
  el.className = 'modal fade';
  el.tabIndex = -1;
  el.setAttribute('aria-labelledby', 'cancel-title');
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="modal-dialog modal-dialog-centered"><div class="modal-content">
      <div class="modal-header"><h2 class="modal-title h5" id="cancel-title">${esc(title)}</h2>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
      <div class="modal-body">
        <p class="mb-3">${esc(summary)}</p>
        <div class="field mb-0">
          <label for="cancel-reason" class="form-label">${esc(label)}</label>
          <textarea id="cancel-reason" class="form-control" rows="3" maxlength="300" required></textarea>
          <div class="field-error" id="cancel-reason-error" hidden></div>
        </div>
        <div class="notice notice-error mt-3" id="cancel-error" role="alert" hidden></div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-ghost" data-bs-dismiss="modal">${esc(keepLabel)}</button>
        <button type="button" class="btn btn-danger" id="cancel-confirm">${esc(confirmLabel)}</button>
      </div>
    </div></div>`;
  document.body.appendChild(el);

  const modal = new window.bootstrap.Modal(el);
  const reason = el.querySelector('#cancel-reason');
  const reasonError = el.querySelector('#cancel-reason-error');
  const generalError = el.querySelector('#cancel-error');
  const confirm = el.querySelector('#cancel-confirm');

  confirm.addEventListener('click', async () => {
    generalError.hidden = true;
    const text = reason.value.trim();
    if (text.length < 3) {
      reason.classList.add('is-invalid');
      reasonError.textContent = 'Please give a reason (at least 3 characters).';
      reasonError.hidden = false;
      reason.focus();
      return;
    }
    reason.classList.remove('is-invalid');
    reasonError.hidden = true;
    setLoading(confirm, true, busyLabel);
    try {
      await onConfirm(text);
      modal.hide();
    } catch (error) {
      setLoading(confirm, false);
      generalError.textContent = error.message || 'Could not cancel. Please try again.';
      generalError.hidden = false;
    }
  });

  el.addEventListener('shown.bs.modal', () => reason.focus());
  el.addEventListener('hidden.bs.modal', () => { modal.dispose(); el.remove(); });
  modal.show();
}

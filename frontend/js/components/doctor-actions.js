import { api } from '../core/api.js';
import { esc } from '../core/ui.js';
import { openCancelModal } from './cancel-modal.js';
import { confirmModal } from './confirm-modal.js';
import { showToast } from '../core/toast.js';
import { todayIST, nowHM } from '../core/dates.js';

// Buttons a doctor may press for an appointment right now. The server checks every rule again.
export function actionButtons(a) {
  const today = todayIST();
  const now = nowHM();
  const btn = (act, label, cls) => `<button type="button" class="${cls}" data-act="${act}" data-id="${esc(a._id)}" data-who="${esc(a.patient.name)}">${label}</button>`;
  const out = [];
  if (a.status === 'pending' || a.status === 'rescheduled') {
    out.push(btn('confirm', 'Confirm', 'btn btn-brand btn-sm-brand'), btn('reject', 'Decline', 'btn-danger-ghost'));
  }
  if (a.status === 'confirmed') {
    if (a.appointmentDate <= today) out.push(btn('complete', 'Mark completed', 'btn btn-brand btn-sm-brand'));
    if (a.appointmentDate < today || (a.appointmentDate === today && a.slotTime <= now)) out.push(btn('no-show', 'No-show', 'btn btn-ghost btn-sm-brand'));
    if (a.appointmentDate >= today) out.push(btn('cancel', 'Cancel', 'btn-danger-ghost'));
  }
  return out.join('');
}

const put = (id, body) => api.put(`/doctor/appointments/${encodeURIComponent(id)}/status`, body);

async function run(action, id, who, onDone) {
  try {
    if (action === 'confirm') { await put(id, { action }); showToast('Appointment confirmed.', 'success'); onDone(); return; }
    if (action === 'reject' || action === 'cancel') {
      openCancelModal({
        title: action === 'reject' ? 'Decline this request?' : 'Cancel this appointment?',
        summary: `${who} will be told the reason you give.`, label: 'Reason',
        confirmLabel: action === 'reject' ? 'Decline request' : 'Cancel appointment', keepLabel: 'Go back', busyLabel: 'Please wait...',
        onConfirm: async (reason) => { await put(id, { action, reason }); showToast(action === 'reject' ? 'Request declined.' : 'Appointment cancelled.', 'success'); onDone(); },
      });
      return;
    }
    confirmModal({
      title: action === 'complete' ? 'Mark this visit as completed?' : 'Mark this patient as a no-show?',
      message: action === 'complete' ? `${who}'s visit will be marked completed.` : `${who} did not attend. The time slot becomes free.`,
      confirmLabel: action === 'complete' ? 'Yes, completed' : 'Yes, no-show', confirmClass: action === 'complete' ? 'btn-brand' : 'btn-danger',
      onConfirm: async () => { await put(id, { action }); showToast(action === 'complete' ? 'Visit marked completed.' : 'Marked as no-show.', 'success'); onDone(); },
    });
  } catch (error) { showToast(error.message, 'error'); onDone(); }
}

// Call ONCE on a container that stays on the page (its inner HTML may change; the listener stays).
export function bindActions(root, onDone) {
  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-act]');
    if (button && root.contains(button)) run(button.dataset.act, button.dataset.id, button.dataset.who, onDone);
  });
}

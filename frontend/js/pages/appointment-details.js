import { requireRole } from '../core/guard.js';
import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { summaryList } from '../components/appointment-summary.js';
import { openCancelModal } from '../components/cancel-modal.js';
import { esc, statusBadge, stateBox } from '../core/ui.js';
import { showToast } from '../core/toast.js';
import { formatDate, to12h, isFuture, todayIST } from '../core/dates.js';

const user = await requireRole('patient');
mountLayout({ user, active: 'appointments' });

const params = new URLSearchParams(window.location.search);
const id = params.get('id');
const root = document.getElementById('details');
const ACTIVE = ['pending', 'confirmed', 'rescheduled'];
let timer;

if (params.get('rescheduled')) showToast('Appointment rescheduled. The doctor will confirm the new time.', 'success');

function queuePanel(a, queue) {
  if (!ACTIVE.includes(a.status)) return '';
  if (!queue || !queue.live) {
    return `<section class="panel token-card"><h2 class="h5">Your token</h2><p class="token-big">${esc(a.tokenNumber || 'Pending')}</p>
      <p class="small text-muted mb-0">Live queue status appears here on the day of your visit.</p></section>`;
  }
  return `<section class="panel token-card" aria-live="polite"><h2 class="h5">Today's queue</h2>
    <p class="mb-0 text-muted">Your token</p><p class="token-big">${esc(queue.tokenNumber || a.tokenNumber || '')}</p>
    <div class="queue-grid">
      <div><strong>${esc(queue.patientsAhead)}</strong><span>Patients ahead</span></div>
      <div><strong>${esc(queue.lastCompleted || 'None')}</strong><span>Last completed token</span></div>
      <div><strong>${esc(queue.estimatedWaitMinutes)} min</strong><span>Estimated wait</span></div>
    </div>
    <p class="small text-muted mt-3 mb-0">This is an estimate and can change. Updates every 30 seconds.</p></section>`;
}

function historyPanel(a) {
  const h = a.rescheduleHistory || [];
  if (!h.length) return '';
  return `<section class="panel"><h2 class="h5">Reschedule history</h2><ul class="timeline">${h.map((x) =>
    `<li>${esc(formatDate(x.oldDate))} ${esc(to12h(x.oldTime))} &rarr; <strong>${esc(formatDate(x.newDate))} ${esc(to12h(x.newTime))}</strong>${x.reason ? `<br><span class="text-muted">${esc(x.reason)}</span>` : ''}</li>`).join('')}</ul></section>`;
}

function render(a, queue) {
  const active = ACTIVE.includes(a.status);
  const future = isFuture(a.appointmentDate, a.slotTime);
  const canChange = active && future;
  const left = 3 - (a.rescheduleHistory || []).length;
  const needsPay = active && a.paymentStatus !== 'paid';
  document.title = `Appointment ${a.appointmentId} | CuraLink Health`;

  root.innerHTML = `
  <p class="mb-3">${statusBadge(a.status)}</p>
  ${['cancelled', 'rejected'].includes(a.status) ? `<div class="notice notice-info mb-3">${a.status === 'rejected' ? 'Declined' : 'Cancelled'}${a.cancellationReason ? `: ${esc(a.cancellationReason)}` : ''}</div>` : ''}
  <div class="details-grid">
    <div>
      <section class="panel"><h2 class="h5">Appointment</h2>${summaryList(a)}
        ${a.consultationType === 'video' ? `<p class="small text-muted mt-3 mb-0"><i class="fa-solid fa-video me-1" aria-hidden="true"></i>${a.status === 'confirmed' && a.appointmentDate === todayIST() ? 'Your video room is open today. It works as a simple demo chat, not a real video call.' : 'The video room opens on the day of a confirmed appointment (a simple demo chat, not a real video call).'}</p>` : ''}</section>
      ${historyPanel(a)}
    </div>
    <div>
      ${queuePanel(a, queue)}
      <section class="panel"><h2 class="h5">Actions</h2><div class="d-grid gap-2">
        ${a.consultationType === 'video' && a.status === 'confirmed' && a.appointmentDate === todayIST() ? `<a class="btn btn-brand" href="${PATHS.patient.room}?id=${encodeURIComponent(a._id)}"><i class="fa-solid fa-video me-1" aria-hidden="true"></i>Open video room</a>` : ''}
        ${a.status === 'completed' ? `<a class="btn btn-ghost" href="${PATHS.patient.feedback}">Review this visit</a>` : ''}
        ${needsPay ? `<a class="btn btn-brand" href="${PATHS.patient.payment}?id=${encodeURIComponent(a._id)}">Pay now (demo)</a>` : ''}
        ${canChange && left > 0 ? `<a class="btn btn-ghost" href="${PATHS.bookAppointment}?reschedule=${encodeURIComponent(a._id)}">Reschedule</a>` : ''}
        ${canChange && left <= 0 ? '<p class="small text-muted mb-0">You have used all 3 reschedules. You can cancel and book again.</p>' : ''}
        ${canChange ? '<button type="button" class="btn-danger-ghost" id="cancel-btn">Cancel appointment</button>' : ''}
        <a class="btn btn-ghost" href="${PATHS.patient.appointments}">Back to my appointments</a>
      </div></section>
    </div>
  </div>`;

  document.getElementById('cancel-btn')?.addEventListener('click', () => openCancelModal({
    summary: `You are cancelling your appointment with ${(a.doctor || {}).name || 'the doctor'} on ${a.appointmentDate} at ${to12h(a.slotTime)}.`,
    onConfirm: async (reason) => {
      await api.put(`/appointments/${encodeURIComponent(a._id)}/cancel`, { reason });
      showToast('Appointment cancelled. The time slot is free again.', 'success');
      refresh();
    },
  }));
}

async function refresh() {
  const { appointment, queue } = (await api.get(`/appointments/${encodeURIComponent(id)}`)).data;
  render(appointment, queue);
  clearInterval(timer);
  if (queue && queue.live) timer = setInterval(() => { // keep the queue fresh on the day of the visit
    api.get(`/appointments/${encodeURIComponent(id)}`).then((r) => render(r.data.appointment, r.data.queue)).catch(() => {});
  }, 30000);
}

if (!id) {
  root.innerHTML = stateBox('No appointment selected', 'Open one from your appointments list.', { href: PATHS.patient.appointments, label: 'My appointments' });
} else {
  try { await refresh(); } catch (error) {
    root.innerHTML = stateBox(error.status === 404 ? 'Appointment not found' : 'Could not load this appointment', error.message, { href: PATHS.patient.appointments, label: 'My appointments' });
  }
}

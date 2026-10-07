import { requireRole } from '../core/guard.js';
import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { actionButtons, bindActions } from '../components/doctor-actions.js';
import { patientLine } from '../components/doctor-appt-card.js';
import { esc, statusBadge, stateBox } from '../core/ui.js';
import { formatDate, to12h } from '../core/dates.js';

const user = await requireRole('doctor');
mountLayout({ user, active: 'queue' });
const root = document.getElementById('queue');

async function load() {
  try {
    const { date, appointments, counts, nowServing } = (await api.get('/doctor/queue')).data;
    document.getElementById('sub').textContent = `${formatDate(date)}. Patients in token order. Updates every 30 seconds.`;
    if (!appointments.length) { root.innerHTML = stateBox('No patients today', 'Appointments booked for today will appear here in token order.', { href: PATHS.doctor.appointments, label: 'All appointments' }); return; }
    let servingMarked = false;
    root.innerHTML = `
    <div class="queue-summary">
      <div><strong>${esc(nowServing || '-')}</strong><span>Now serving</span></div>
      <div><strong>${esc(counts.waiting)}</strong><span>Waiting</span></div>
      <div><strong>${esc(counts.completed)}</strong><span>Completed</span></div>
      <div><strong>${esc(counts.total)}</strong><span>Total today</span></div>
    </div>
    <ul class="queue-list">${appointments.map((a) => {
      const serving = !servingMarked && a.status === 'confirmed' && (servingMarked = true);
      const done = ['completed', 'no-show'].includes(a.status);
      return `<li class="queue-row ${serving ? 'serving' : ''} ${done ? 'done' : ''}">
        <div class="token-chip"><small>Token</small>${esc(a.tokenNumber || '-')}</div>
        <div><h2>${esc(a.patient.name)}${serving ? ' <span class="st st-confirmed">Now serving</span>' : ''}</h2>
          <p class="appt-meta mb-1">${esc(to12h(a.slotTime))} &middot; ${esc(patientLine(a.patient))}${a.reason ? ` &middot; ${esc(a.reason)}` : ''}</p>${statusBadge(a.status)}</div>
        <div class="appt-actions"><a class="btn btn-ghost btn-sm-brand" href="${PATHS.doctor.consultation}?id=${encodeURIComponent(a._id)}">Open</a>${actionButtons(a)}</div></li>`;
    }).join('')}</ul>`;
  } catch (error) { root.innerHTML = stateBox('Could not load the queue', error.message); }
}
bindActions(root, load);
load();
setInterval(() => { if (!document.querySelector('.modal.show')) load(); }, 30000); // do not refresh behind an open pop-up

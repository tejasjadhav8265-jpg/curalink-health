import { requireRole } from '../core/guard.js';
import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { doctorApptCard, patientLine } from '../components/doctor-appt-card.js';
import { bindActions } from '../components/doctor-actions.js';
import { esc, stateBox } from '../core/ui.js';
import { showToast } from '../core/toast.js';
import { to12h, formatDate } from '../core/dates.js';

const user = await requireRole('doctor');
mountLayout({ user, active: 'dashboard' });
if (new URLSearchParams(window.location.search).get('denied')) showToast('That page is not available for your account type.', 'error');

const root = document.getElementById('dash');
const D = PATHS.doctor;

async function load() {
  try {
    const d = (await api.get('/doctor/dashboard')).data;
    const s = d.stats;
    document.getElementById('page-title').textContent = `Welcome, ${d.doctor.name}`;
    const nextBox = d.next
      ? `<div class="next-appt"><div><h3 class="h5 mb-1">${esc(d.next.patient.name)}</h3><p class="text-muted mb-2">${esc(patientLine(d.next.patient))}</p>
          <p class="mb-2"><strong>${esc(to12h(d.next.slotTime))}</strong> &middot; ${d.next.consultationType === 'video' ? 'Video' : 'In-person'}${d.next.reason ? ` &middot; ${esc(d.next.reason)}` : ''}</p></div>
          ${d.next.tokenNumber ? `<div class="ms-auto text-center"><div class="text-muted small">Token</div><p class="token-big">${esc(d.next.tokenNumber)}</p></div>` : ''}</div>
        <a class="btn btn-brand btn-sm-brand mt-3" href="${D.consultation}?id=${encodeURIComponent(d.next._id)}">Open consultation</a>`
      : '<p class="text-muted mb-0">No confirmed patients waiting right now.</p>';

    root.innerHTML = `
    <div class="stat-grid">
      <a class="stat" href="${D.appointments}?tab=today"><strong>${esc(s.today)}</strong><span>Today's appointments</span></a>
      <a class="stat" href="${D.appointments}?tab=pending"><strong>${esc(s.pending)}</strong><span>Pending requests</span></a>
      <a class="stat" href="${D.queue}"><strong>${esc(s.completedToday)}</strong><span>Completed today</span></a>
      <a class="stat" href="${D.appointments}?tab=upcoming"><strong>${esc(s.upcoming)}</strong><span>Later appointments</span></a>
      <a class="stat" href="${D.patients}"><strong>${esc(s.patients)}</strong><span>Patients</span></a>
      <a class="stat" href="${D.notifications}"><strong>${esc(s.unreadNotifications)}</strong><span>Unread notifications</span></a>
    </div>
    <div class="two-col">
      <div class="stack" id="actions-root">
        <section class="panel"><h2 class="h5">Pending requests</h2>
          ${d.pending.length ? `<div class="appt-list">${d.pending.map(doctorApptCard).join('')}</div>${s.pending > d.pending.length ? `<a class="small d-inline-block mt-2" href="${D.appointments}?tab=pending">See all ${esc(s.pending)}</a>` : ''}` : '<p class="text-muted mb-0">No requests waiting. You are all caught up.</p>'}</section>
        <section class="panel"><h2 class="h5">Today, ${esc(formatDate(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })))}</h2>
          ${d.today.length ? `<div class="appt-list">${d.today.map(doctorApptCard).join('')}</div>` : '<p class="text-muted mb-0">No appointments today.</p>'}</section>
      </div>
      <div class="stack">
        <section class="panel"><h2 class="h5">Next patient</h2>${nextBox}</section>
        <section class="panel"><h2 class="h5">Quick actions</h2><div class="action-grid">
          <a class="action" href="${D.queue}"><i class="fa-solid fa-list-ol" aria-hidden="true"></i>Today's queue</a>
          <a class="action" href="${D.availability}"><i class="fa-regular fa-clock" aria-hidden="true"></i>Availability</a>
          <a class="action" href="${D.patients}"><i class="fa-solid fa-users" aria-hidden="true"></i>My patients</a>
          <a class="action" href="${D.prescriptions}"><i class="fa-solid fa-prescription-bottle-medical" aria-hidden="true"></i>Prescriptions</a>
        </div></section>
      </div>
    </div>`;
  } catch (error) { root.innerHTML = stateBox('Could not load your dashboard', error.message); }
}
bindActions(root, load); // one listener on the stable container
load();

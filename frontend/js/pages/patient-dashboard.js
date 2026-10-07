import { requireRole } from '../core/guard.js';
import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { esc, statusBadge, stateBox } from '../core/ui.js';
import { showToast } from '../core/toast.js';
import { formatDate, to12h, formatDateTime, formatDay } from '../core/dates.js';

const user = await requireRole('patient');
mountLayout({ user, active: 'dashboard' });
if (new URLSearchParams(window.location.search).get('denied')) showToast('That page is not available for your account type.', 'error');

const root = document.getElementById('dash');
const safeLink = (l) => (typeof l === 'string' && /^\/pages\/[A-Za-z0-9\/_\-.]+\.html(\?[A-Za-z0-9=&_%\-]*)?$/.test(l) ? l : null);
const P = PATHS.patient;

function nextCard(a, queue) {
  if (!a) return stateBox('No upcoming appointments', 'Book a visit with one of our doctors.', { href: PATHS.findDoctor, label: 'Find a doctor' });
  const details = `${P.appointmentDetails}?id=${encodeURIComponent(a._id)}`;
  const live = queue && queue.live
    ? `<p class="mb-0 mt-3"><strong>${esc(queue.patientsAhead)}</strong> patients ahead of you. Estimated wait about <strong>${esc(queue.estimatedWaitMinutes)} min</strong>.</p>` : '';
  return `<div class="next-appt">
      <div><h3 class="h5 mb-1">${esc((a.doctor || {}).name || 'Doctor')}</h3>
        <p class="text-muted mb-2">${esc((a.doctor || {}).specialization || '')}</p>
        <p class="mb-2"><strong>${esc(formatDate(a.appointmentDate))}</strong> at <strong>${esc(to12h(a.slotTime))}</strong> &middot; ${a.consultationType === 'video' ? 'Video' : 'In-person'}</p>
        <p class="mb-0">${statusBadge(a.status)}</p></div>
      ${a.tokenNumber ? `<div class="ms-auto text-center"><div class="text-muted small">Token</div><p class="token-big">${esc(a.tokenNumber)}</p></div>` : ''}
    </div>${live}
    <div class="mt-3 d-flex gap-2 flex-wrap"><a class="btn btn-brand btn-sm-brand" href="${details}">View details</a>
      <a class="btn btn-ghost btn-sm-brand" href="${P.appointments}">All appointments</a></div>`;
}

try {
  const d = (await api.get('/patients/dashboard')).data;
  const s = d.stats;
  document.getElementById('page-title').textContent = `Welcome, ${d.user.firstName}`;

  root.innerHTML = `
  ${s.unpaid ? `<div class="alert-strip" role="status"><span><i class="fa-solid fa-circle-exclamation me-2" aria-hidden="true"></i>${esc(s.unpaid)} upcoming ${s.unpaid === 1 ? 'appointment has' : 'appointments have'} no payment yet (demo).</span><a class="btn btn-ghost btn-sm-brand" href="${P.appointments}">Review</a></div>` : ''}
  <div class="stat-grid">
    <a class="stat" href="${P.appointments}"><strong>${esc(s.upcoming)}</strong><span>Upcoming appointments</span></a>
    <a class="stat" href="${P.appointments}?view=past"><strong>${esc(s.past)}</strong><span>Past visits</span></a>
    <a class="stat" href="${P.prescriptions}"><strong>${esc(s.prescriptions)}</strong><span>Prescriptions</span></a>
    <a class="stat" href="${P.records}"><strong>${esc(s.reports)}</strong><span>Reports</span></a>
    <a class="stat" href="${P.notifications}"><strong>${esc(s.unreadNotifications)}</strong><span>Unread notifications</span></a>
  </div>
  <div class="two-col">
    <div class="stack">
      <section class="panel"><h2 class="h5">Next appointment</h2>${nextCard(d.nextAppointment, d.queue)}</section>
      <section class="panel"><h2 class="h5">Quick actions</h2><div class="action-grid">
        <a class="action" href="${PATHS.findDoctor}"><i class="fa-solid fa-user-doctor" aria-hidden="true"></i>Book a doctor</a>
        <a class="action" href="${P.appointments}"><i class="fa-regular fa-calendar-check" aria-hidden="true"></i>Appointments</a>
        <a class="action" href="${P.records}"><i class="fa-solid fa-folder-open" aria-hidden="true"></i>Medical records</a>
        <a class="action" href="${P.prescriptions}"><i class="fa-solid fa-prescription-bottle-medical" aria-hidden="true"></i>Prescriptions</a>
        <a class="action" href="${P.payments}"><i class="fa-solid fa-receipt" aria-hidden="true"></i>Payments</a>
        <a class="action" href="${P.profile}"><i class="fa-regular fa-id-card" aria-hidden="true"></i>My profile</a>
      </div></section>
    </div>
    <div class="stack">
      <section class="panel"><h2 class="h5">Recent notifications</h2>
        ${d.recentNotifications.length ? `<ul class="mini-list">${d.recentNotifications.map((n) => { const l = safeLink(n.link); return `<li>${l ? `<a href="${esc(l)}">${esc(n.title)}</a>` : `<strong>${esc(n.title)}</strong>`}${n.isRead ? '' : ' <span class="st st-pending">New</span>'}<br><span class="when">${esc(formatDateTime(n.createdAt))}</span></li>`; }).join('')}</ul>
        <a class="small" href="${P.notifications}">See all</a>` : '<p class="text-muted mb-0">Nothing new yet.</p>'}</section>
      <section class="panel"><h2 class="h5">Recent prescriptions</h2>
        ${d.recentPrescriptions.length ? `<ul class="mini-list">${d.recentPrescriptions.map((p) => `<li><a href="${P.prescriptions}">${esc(p.diagnosis)}</a><br><span class="when">${esc((p.doctor || {}).name || 'Doctor')} &middot; ${esc(formatDay(p.createdAt))} &middot; ${esc(p.medicineCount)} ${p.medicineCount === 1 ? 'medicine' : 'medicines'}</span></li>`).join('')}</ul>
        <a class="small" href="${P.prescriptions}">See all</a>` : '<p class="text-muted mb-0">No prescriptions yet.</p>'}</section>
    </div>
  </div>`;
} catch (error) {
  root.innerHTML = stateBox('Could not load your dashboard', error.message);
}

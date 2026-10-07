import { requireRole } from '../core/guard.js';
import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { openCancelModal } from '../components/cancel-modal.js';
import { esc, statusBadge, paymentBadge, stateBox, skeletonCards } from '../core/ui.js';
import { showToast } from '../core/toast.js';
import { to12h, isFuture } from '../core/dates.js';

const user = await requireRole('patient');
mountLayout({ user, active: 'appointments' });

const root = document.getElementById('list');
const TABS = [['upcoming', 'Upcoming'], ['past', 'Past'], ['cancelled', 'Cancelled']];
const EMPTY = {
  upcoming: ['No upcoming appointments', 'Book a visit with one of our doctors.'],
  past: ['No past appointments yet', 'Completed visits will appear here.'],
  cancelled: ['No cancelled appointments', 'Cancelled or declined visits will appear here.'],
};
const ACTIVE = ['pending', 'confirmed', 'rescheduled'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

let view = ['upcoming', 'past', 'cancelled'].includes(new URLSearchParams(window.location.search).get('view')) ? new URLSearchParams(window.location.search).get('view') : 'upcoming';
let page = 1;
let counts = { upcoming: 0, past: 0, cancelled: 0 };

function card(a) {
  const doc = a.doctor || {};
  const [, m, d] = a.appointmentDate.split('-');
  const details = `${PATHS.patient.appointmentDetails}?id=${encodeURIComponent(a._id)}`;
  const canChange = ACTIVE.includes(a.status) && isFuture(a.appointmentDate, a.slotTime);
  const canReschedule = canChange && (a.rescheduleHistory || []).length < 3;
  return `<article class="appt-card">
    <div class="appt-date" aria-hidden="true"><span class="d">${esc(d)}</span><span class="m">${esc(MONTHS[Number(m) - 1])}</span></div>
    <div class="appt-main">
      <h2><a href="${details}">${esc(doc.name || 'Doctor')}</a></h2>
      <p class="appt-meta">${esc(doc.specialization || '')} &middot; ${esc(to12h(a.slotTime))} &middot; ${a.consultationType === 'video' ? 'Video' : 'In-person'}${a.tokenNumber ? ` &middot; Token ${esc(a.tokenNumber)}` : ''}</p>
      <p class="mb-0">${statusBadge(a.status)} ${ACTIVE.includes(a.status) ? paymentBadge(a.paymentStatus) : ''}</p>
    </div>
    <div class="appt-actions">
      <a class="btn btn-brand btn-sm-brand" href="${details}">View details</a>
      ${canReschedule ? `<a class="btn btn-ghost btn-sm-brand" href="${PATHS.bookAppointment}?reschedule=${encodeURIComponent(a._id)}">Reschedule</a>` : ''}
      ${canChange ? `<button type="button" class="btn-danger-ghost" data-cancel="${esc(a._id)}" data-summary="${esc(`${doc.name || 'Doctor'} on ${a.appointmentDate} at ${to12h(a.slotTime)}`)}">Cancel</button>` : ''}
    </div>
  </article>`;
}

function renderTabs() {
  return `<div class="appt-tabs" role="tablist" aria-label="Appointment filters">${TABS.map(([key, label]) =>
    `<button type="button" class="appt-tab" role="tab" id="tab-${key}" aria-selected="${key === view}" aria-controls="panel" data-view="${key}">${label}<span class="count">${counts[key]}</span></button>`).join('')}</div>`;
}

async function load() {
  root.innerHTML = `${renderTabs()}<div id="panel" role="tabpanel" aria-labelledby="tab-${view}"><div class="doc-list">${skeletonCards(3)}</div></div>`;
  bindTabs();
  try {
    const { appointments, counts: c, pagination } = (await api.get(`/appointments?view=${view}&page=${page}&limit=8`)).data;
    counts = c;
    const panel = appointments.length
      ? `<div class="appt-list">${appointments.map(card).join('')}</div>${pagination.pages > 1 ? `<nav class="pager" aria-label="Pages">
          <button class="btn btn-ghost" id="prev" ${page <= 1 ? 'disabled' : ''}>Previous</button>
          <span>Page ${pagination.page} of ${pagination.pages}</span>
          <button class="btn btn-ghost" id="next" ${page >= pagination.pages ? 'disabled' : ''}>Next</button></nav>` : ''}`
      : stateBox(...EMPTY[view], view === 'upcoming' ? { href: PATHS.findDoctor, label: 'Find a doctor' } : null);
    root.innerHTML = `${renderTabs()}<div id="panel" role="tabpanel" aria-labelledby="tab-${view}">${panel}</div>`;
    bindTabs();
    document.getElementById('prev')?.addEventListener('click', () => { page -= 1; load(); });
    document.getElementById('next')?.addEventListener('click', () => { page += 1; load(); });
    root.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', () => askCancel(b.dataset.cancel, b.dataset.summary)));
  } catch (error) {
    root.innerHTML = stateBox('Could not load your appointments', error.message);
  }
}

function bindTabs() {
  root.querySelectorAll('.appt-tab').forEach((t) => t.addEventListener('click', () => { view = t.dataset.view; page = 1; load(); }));
}

function askCancel(id, summary) {
  openCancelModal({
    summary: `You are cancelling your appointment with ${summary}.`,
    onConfirm: async (reason) => {
      await api.put(`/appointments/${encodeURIComponent(id)}/cancel`, { reason });
      showToast('Appointment cancelled. The time slot is free again.', 'success');
      load();
    },
  });
}

load();

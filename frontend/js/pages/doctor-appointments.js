import { requireRole } from '../core/guard.js';
import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { doctorApptCard } from '../components/doctor-appt-card.js';
import { bindActions } from '../components/doctor-actions.js';
import { stateBox, skeletonCards } from '../core/ui.js';

const user = await requireRole('doctor');
mountLayout({ user, active: 'appointments' });
const root = document.getElementById('list');

const TABS = [['today', 'Today'], ['pending', 'Pending requests'], ['upcoming', 'Upcoming'], ['history', 'Completed'], ['cancelled', 'Cancelled']];
const EMPTY = {
  today: ['No appointments today', 'Enjoy the quiet, or check your upcoming appointments.'],
  pending: ['No pending requests', 'New booking requests will appear here.'],
  upcoming: ['No upcoming appointments', 'Future bookings will appear here.'],
  history: ['No completed visits yet', 'Visits you complete or mark as no-show appear here.'],
  cancelled: ['Nothing cancelled', 'Cancelled and declined appointments appear here.'],
};
const fromUrl = new URLSearchParams(window.location.search).get('tab');
let tab = TABS.some(([k]) => k === fromUrl) ? fromUrl : 'today';
let page = 1;
let counts = {};

const tabsHtml = () => `<div class="appt-tabs" role="tablist" aria-label="Appointment filters">${TABS.map(([k, label]) =>
  `<button type="button" class="appt-tab" role="tab" id="tab-${k}" aria-selected="${k === tab}" aria-controls="panel" data-tab="${k}">${label}<span class="count">${counts[k] ?? 0}</span></button>`).join('')}</div>`;

async function load() {
  root.innerHTML = `${tabsHtml()}<div id="panel" role="tabpanel" aria-labelledby="tab-${tab}"><div class="doc-list">${skeletonCards(3)}</div></div>`;
  bindTabs();
  try {
    const { appointments, counts: c, pagination } = (await api.get(`/doctor/appointments?tab=${tab}&page=${page}&limit=8`)).data;
    counts = c;
    const body = appointments.length
      ? `<div class="appt-list">${appointments.map(doctorApptCard).join('')}</div>${pagination.pages > 1 ? `<nav class="pager mt-3" aria-label="Pages"><button class="btn btn-ghost" id="prev" ${page <= 1 ? 'disabled' : ''}>Previous</button><span>Page ${pagination.page} of ${pagination.pages}</span><button class="btn btn-ghost" id="next" ${page >= pagination.pages ? 'disabled' : ''}>Next</button></nav>` : ''}`
      : stateBox(...EMPTY[tab], tab === 'today' ? { href: PATHS.doctor.queue, label: "Today's queue" } : null);
    root.innerHTML = `${tabsHtml()}<div id="panel" role="tabpanel" aria-labelledby="tab-${tab}">${body}</div>`;
    bindTabs();
    document.getElementById('prev')?.addEventListener('click', () => { page -= 1; load(); });
    document.getElementById('next')?.addEventListener('click', () => { page += 1; load(); });
  } catch (error) { root.innerHTML = stateBox('Could not load appointments', error.message); }
}
function bindTabs() { root.querySelectorAll('.appt-tab').forEach((t) => t.addEventListener('click', () => { tab = t.dataset.tab; page = 1; load(); })); }

bindActions(root, load);
load();

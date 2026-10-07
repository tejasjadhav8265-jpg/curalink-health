import { getCurrentUser } from '../core/auth.js';
import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { openModal } from '../components/modal.js';
import { confirmModal } from '../components/confirm-modal.js';
import { esc, stateBox, formatFee, setLoading, setFieldError, showNotice } from '../core/ui.js';
import { showToast } from '../core/toast.js';
import { todayIST, addDays, formatDate } from '../core/dates.js';

const user = await getCurrentUser();
mountLayout({ user, active: 'packages' });
const root = document.getElementById('root');
const isPatient = user && user.role === 'patient';
const loginUrl = `${PATHS.login}?next=${encodeURIComponent(window.location.pathname)}`;
const STATUS = { pending: ['Awaiting confirmation', 'st-pending'], confirmed: ['Confirmed', 'st-confirmed'], completed: ['Completed', 'st-completed'], cancelled: ['Cancelled', 'st-cancelled'] };

async function load() {
  try {
    const { packages } = (await api.get('/packages')).data;
    const mine = isPatient ? (await api.get('/packages/mine')).data.bookings : [];
    root.innerHTML = `${packages.length ? `<div class="card-grid">${packages.map((p) => `<article class="info-card">
        <h2>${esc(p.name)}</h2><p>${esc(p.description || '')}</p>
        <ul class="grow">${p.tests.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        <div class="price">${esc(formatFee(p.price))} <small>${esc(p.duration || '')}</small></div>
        ${isPatient ? `<button type="button" class="btn btn-brand" data-book="${esc(p._id)}" data-name="${esc(p.name)}">Request this package</button>`
          : user ? '<p class="small">Only patient accounts can request packages.</p>' : `<a class="btn btn-brand" href="${loginUrl}">Log in to request</a>`}
      </article>`).join('')}</div>` : stateBox('No packages yet', 'Packages will appear here when the hospital adds them.')}
      ${isPatient ? `<section class="mt-5"><h2 class="h4">My package requests</h2>${mine.length ? `<div class="data-table-wrap"><table class="data-table"><caption class="visually-hidden">My package requests</caption>
        <thead><tr><th scope="col">Package</th><th scope="col">Preferred date</th><th scope="col">Status</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead>
        <tbody>${mine.map((b) => `<tr><td><span class="name">${esc(b.name)}</span><span class="sub">${esc(formatFee(b.price))} &middot; pay at the hospital (demo)</span></td><td>${esc(formatDate(b.preferredDate))}</td>
          <td><span class="st ${(STATUS[b.status] || STATUS.pending)[1]}">${esc((STATUS[b.status] || STATUS.pending)[0])}</span></td>
          <td>${['pending', 'confirmed'].includes(b.status) ? `<button type="button" class="btn-danger-ghost" data-cancel="${esc(b._id)}" data-name="${esc(b.name)}">Cancel</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="text-muted">You have not requested a package yet.</p>'}</section>` : ''}`;
    root.querySelectorAll('[data-book]').forEach((b) => b.addEventListener('click', () => bookModal(b.dataset.book, b.dataset.name)));
    root.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', () => cancel(b.dataset)));
  } catch (error) { root.innerHTML = stateBox('Could not load packages', error.message); }
}

function bookModal(id, name) {
  const today = todayIST();
  const m = openModal({
    title: name,
    bodyHtml: `<form id="bk" novalidate><div id="bk-notice" tabindex="-1"></div>
      <div class="field mb-0"><label for="preferredDate">Preferred date</label><input class="form-control" type="date" id="preferredDate" min="${today}" max="${addDays(today, 90)}" value="${addDays(today, 1)}">
      <div class="help">The hospital will confirm the time. Payment is collected at the hospital (demo).</div><div class="field-error" id="preferredDate-error" hidden></div></div></form>`,
    footerHtml: '<button type="button" class="btn btn-ghost" data-bs-dismiss="modal">Cancel</button><button type="button" class="btn btn-brand" id="bk-go">Send request</button>',
  });
  const go = m.el.querySelector('#bk-go');
  const date = m.el.querySelector('#preferredDate');
  const submit = async () => {
    setFieldError(date, '');
    setLoading(go, true, 'Sending...');
    try { const res = await api.post(`/packages/${encodeURIComponent(id)}/book`, { preferredDate: date.value }); showToast(res.message, 'success'); m.close(); load(); }
    catch (error) { setLoading(go, false); setFieldError(date, (error.errors && error.errors[0] && error.errors[0].message) || ''); showNotice(m.el.querySelector('#bk-notice'), (error.errors && error.errors[0] && error.errors[0].message) || error.message, 'error'); }
  };
  go.addEventListener('click', submit);
  m.el.querySelector('#bk').addEventListener('submit', (e) => { e.preventDefault(); submit(); });
}

function cancel({ cancel: id, name }) {
  confirmModal({ title: `Cancel ${name}?`, message: 'Your request will be cancelled.', confirmLabel: 'Yes, cancel it',
    onConfirm: async () => { const res = await api.patch(`/packages/bookings/${id}/cancel`); showToast(res.message, 'success'); load(); } });
}
load();

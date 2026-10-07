import { requireRole } from '../core/guard.js';
import { api } from '../core/api.js';
import { mountLayout } from '../components/layout.js';
import { openModal } from '../components/modal.js';
import { confirmModal } from '../components/confirm-modal.js';
import { pagerHtml, bindPager } from '../components/pager.js';
import { esc, stateBox, statusBadge } from '../core/ui.js';
import { showToast } from '../core/toast.js';
import { formatDate, to12h, formatDay } from '../core/dates.js';

const user = await requireRole('admin');
mountLayout({ user, active: 'patients' });
const root = document.getElementById('root');
root.innerHTML = `<div class="panel">
  <div class="toolbar">
    <div class="field grow"><label for="q">Search</label><input class="form-control" id="q" type="search" maxlength="60" placeholder="Name, email or mobile number" autocomplete="off"></div>
    <div class="field"><label for="status">Account</label><select class="form-select" id="status"><option value="">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
  </div>
  <div id="results" aria-live="polite"><p class="text-muted">Loading...</p></div></div>`;
const results = document.getElementById('results');
const $ = (id) => document.getElementById(id);
let page = 1;
let timer;

async function load() {
  const params = new URLSearchParams({ page, limit: 10 });
  if ($('q').value.trim()) params.set('q', $('q').value.trim());
  if ($('status').value) params.set('status', $('status').value);
  try {
    const { patients, pagination } = (await api.get(`/admin/patients?${params}`)).data;
    if (!patients.length) { results.innerHTML = stateBox('No patients found', 'Try a different search or filter.'); return; }
    results.innerHTML = `<div class="data-table-wrap"><table class="data-table"><caption class="visually-hidden">Patients</caption>
      <thead><tr><th scope="col">Patient</th><th scope="col">Mobile</th><th scope="col">City</th><th scope="col">Bookings</th><th scope="col">Joined</th><th scope="col">Account</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead>
      <tbody>${patients.map((p) => `<tr><td><span class="name">${esc(p.name)}</span><span class="sub">${esc(p.email)}</span></td><td>${esc(p.phone)}</td><td>${esc(p.city || '-')}</td><td>${esc(p.appointments)}</td><td>${esc(formatDay(p.createdAt))}</td>
        <td><span class="st st-${p.isActive ? 'active' : 'inactive'}">${p.isActive ? 'Active' : 'Inactive'}</span></td>
        <td><div class="actions"><button type="button" class="btn btn-ghost btn-sm-brand" data-view="${esc(p._id)}">View</button>
          <button type="button" class="btn ${p.isActive ? 'btn-danger-ghost' : 'btn-ghost btn-sm-brand'}" data-flip="${esc(p._id)}" data-active="${p.isActive}" data-name="${esc(p.name)}">${p.isActive ? 'Deactivate' : 'Activate'}</button></div></td></tr>`).join('')}</tbody></table></div>
      ${pagerHtml(pagination)}`;
    bindPager(results, (step) => { page += step; load(); });
    results.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => view(b.dataset.view)));
    results.querySelectorAll('[data-flip]').forEach((b) => b.addEventListener('click', () => flip(b.dataset)));
  } catch (error) { results.innerHTML = stateBox('Could not load patients', error.message); }
}

async function view(id) {
  const m = openModal({ title: 'Patient details', bodyHtml: '<p class="text-muted">Loading...</p>' });
  try {
    const { patient: p, recent } = (await api.get(`/admin/patients/${encodeURIComponent(id)}`)).data;
    m.body.innerHTML = `<dl class="kv">
      <dt>Name</dt><dd>${esc(p.name)}</dd><dt>Email</dt><dd>${esc(p.email)}</dd><dt>Mobile</dt><dd>${esc(p.phone)}</dd>
      <dt>City</dt><dd>${esc([p.city, p.state].filter(Boolean).join(', ') || '-')}</dd><dt>Date of birth</dt><dd>${esc(p.dob ? formatDate(p.dob) : '-')}</dd>
      <dt>Gender</dt><dd>${esc(p.gender || '-')}</dd><dt>Emergency contact</dt><dd>${esc(p.emergencyContact || '-')}</dd>
      <dt>Account</dt><dd>${p.isActive ? 'Active' : 'Inactive (cannot log in)'}</dd><dt>Joined</dt><dd>${esc(formatDay(p.createdAt))}</dd></dl>
      <p class="help mt-3">Medical records, reports and prescriptions are private and are not shown to admins.</p>
      <h3 class="h6 mt-3">Recent appointments (${esc(p.appointments)} in total)</h3>
      ${recent.length ? `<ul class="mini-list">${recent.map((a) => `<li>${esc(formatDate(a.appointmentDate))} at ${esc(to12h(a.slotTime))} with ${esc(a.doctor ? a.doctor.name : 'Doctor')} ${statusBadge(a.status)}<br><span class="when">${esc(a.appointmentId)}</span></li>`).join('')}</ul>` : '<p class="text-muted">No appointments yet.</p>'}`;
  } catch (error) { m.body.innerHTML = stateBox('Could not load this patient', error.message); }
}

function flip({ flip: id, active, name }) {
  const turnOff = active === 'true';
  confirmModal({
    title: turnOff ? `Deactivate ${name}?` : `Activate ${name}?`,
    message: turnOff ? `${name} will not be able to log in or book appointments until you activate the account again. Existing appointments are not changed.` : `${name} will be able to log in and book again.`,
    confirmLabel: turnOff ? 'Yes, deactivate' : 'Yes, activate', confirmClass: turnOff ? 'btn-danger' : 'btn-brand',
    onConfirm: async () => { const res = await api.patch(`/admin/patients/${id}/status`, { isActive: !turnOff }); showToast(res.message, 'success'); load(); },
  });
}

$('q').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { page = 1; load(); }, 300); });
$('status').addEventListener('change', () => { page = 1; load(); });
load();

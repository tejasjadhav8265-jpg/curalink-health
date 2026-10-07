import { requireRole } from '../core/guard.js';
import { api } from '../core/api.js';
import { mountLayout } from '../components/layout.js';
import { confirmModal } from '../components/confirm-modal.js';
import { pagerHtml, bindPager } from '../components/pager.js';
import { esc, stateBox, formatFee } from '../core/ui.js';
import { showToast } from '../core/toast.js';

const user = await requireRole('admin');
mountLayout({ user, active: 'doctors' });
const root = document.getElementById('root');
const initial = new URLSearchParams(window.location.search);

root.innerHTML = `<div class="panel">
  <div class="toolbar">
    <div class="field grow"><label for="q">Search</label><input class="form-control" id="q" type="search" maxlength="60" placeholder="Name, speciality, email or registration no." autocomplete="off"></div>
    <div class="field"><label for="department">Department</label><select class="form-select" id="department"><option value="">All departments</option></select></div>
    <div class="field"><label for="status">Status</label><select class="form-select" id="status"><option value="">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
  </div>
  <div id="results" aria-live="polite"><p class="text-muted">Loading...</p></div></div>`;

const results = document.getElementById('results');
const $ = (id) => document.getElementById(id);
$('status').value = ['active', 'inactive'].includes(initial.get('status')) ? initial.get('status') : '';
let page = 1;
let timer;

try {
  const { departments } = (await api.get('/admin/departments')).data;
  $('department').insertAdjacentHTML('beforeend', departments.map((d) => `<option value="${esc(d._id)}">${esc(d.name)}</option>`).join(''));
} catch (_) { /* the filter just stays on "All" */ }

async function load() {
  const params = new URLSearchParams({ page, limit: 10 });
  if ($('q').value.trim()) params.set('q', $('q').value.trim());
  if ($('department').value) params.set('department', $('department').value);
  if ($('status').value) params.set('status', $('status').value);
  try {
    const { doctors, pagination } = (await api.get(`/admin/doctors?${params}`)).data;
    if (!doctors.length) { results.innerHTML = stateBox('No doctors found', 'Try different filters, or add a new doctor.', { href: '/pages/admin/doctor-form.html', label: 'Add doctor' }); return; }
    results.innerHTML = `<div class="data-table-wrap"><table class="data-table">
      <caption class="visually-hidden">Doctors</caption>
      <thead><tr><th scope="col">Doctor</th><th scope="col">Department</th><th scope="col">City</th><th scope="col">Fee</th><th scope="col">Upcoming</th><th scope="col">Status</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead>
      <tbody>${doctors.map((d) => `<tr>
        <td><span class="name">${esc(d.name)}</span><span class="sub">${esc(d.specialization)} &middot; ${esc(d.email)}</span></td>
        <td>${esc(d.department || '-')}</td><td>${esc(d.location)}</td><td>${esc(formatFee(d.consultationFee))}</td><td>${esc(d.upcoming)}</td>
        <td><span class="st st-${d.status === 'active' ? 'active' : 'inactive'}">${d.status === 'active' ? 'Active' : 'Inactive'}</span></td>
        <td><div class="actions"><a class="btn btn-ghost btn-sm-brand" href="/pages/admin/doctor-form.html?id=${encodeURIComponent(d._id)}">Edit</a>
          <button type="button" class="btn ${d.status === 'active' ? 'btn-danger-ghost' : 'btn-ghost btn-sm-brand'}" data-toggle="${esc(d._id)}" data-next="${d.status === 'active' ? 'inactive' : 'active'}" data-name="${esc(d.name)}" data-upcoming="${esc(d.upcoming)}">${d.status === 'active' ? 'Deactivate' : 'Activate'}</button></div></td></tr>`).join('')}</tbody></table></div>
      ${pagerHtml(pagination)}`;
    bindPager(results, (step) => { page += step; load(); });
    results.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => toggle(b.dataset)));
  } catch (error) { results.innerHTML = stateBox('Could not load doctors', error.message); }
}

function toggle({ toggle: id, next, name, upcoming }) {
  const off = next === 'inactive';
  confirmModal({
    title: off ? `Deactivate ${name}?` : `Activate ${name}?`,
    message: off
      ? `Patients will no longer see ${name} or be able to book. ${Number(upcoming) ? `The ${upcoming} upcoming appointment(s) are kept, so please contact those patients. ` : ''}The doctor can still log in.`
      : `${name} will appear in search again and patients can book.`,
    confirmLabel: off ? 'Yes, deactivate' : 'Yes, activate', confirmClass: off ? 'btn-danger' : 'btn-brand',
    onConfirm: async () => {
      const res = await api.patch(`/admin/doctors/${id}/status`, { status: next });
      showToast(res.message, 'success');
      if (res.data.warning) showToast(res.data.warning, 'info');
      load();
    },
  });
}

$('q').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { page = 1; load(); }, 300); });
['department', 'status'].forEach((id) => $(id).addEventListener('change', () => { page = 1; load(); }));
load();

import { requireRole } from '../core/guard.js';
import { api } from '../core/api.js';
import { mountLayout } from '../components/layout.js';
import { openCancelModal } from '../components/cancel-modal.js';
import { pagerHtml, bindPager } from '../components/pager.js';
import { esc, stateBox, statusBadge, paymentBadge } from '../core/ui.js';
import { showToast } from '../core/toast.js';
import { formatDate, to12h } from '../core/dates.js';

const user = await requireRole('admin');
mountLayout({ user, active: 'appointments' });
const root = document.getElementById('root');
const initial = new URLSearchParams(window.location.search);
const STATUSES = ['pending', 'confirmed', 'rescheduled', 'completed', 'cancelled', 'rejected', 'no-show'];
const CANCELLABLE = ['pending', 'confirmed', 'rescheduled'];

root.innerHTML = `<div class="panel">
  <div class="toolbar">
    <div class="field grow"><label for="q">Search</label><input class="form-control" id="q" type="search" maxlength="60" placeholder="Booking ID (APT-...) or patient name" autocomplete="off"></div>
    <div class="field"><label for="status">Status</label><select class="form-select" id="status"><option value="">All</option>${STATUSES.map((s) => `<option value="${s}">${esc(s)}</option>`).join('')}</select></div>
    <div class="field"><label for="doctor">Doctor</label><select class="form-select" id="doctor"><option value="">All doctors</option></select></div>
    <div class="field"><label for="date">Date</label><input class="form-control" id="date" type="date"></div>
    <button type="button" class="btn btn-ghost" id="clear">Clear</button>
  </div>
  <div id="results" aria-live="polite"><p class="text-muted">Loading...</p></div></div>`;
const results = document.getElementById('results');
const $ = (id) => document.getElementById(id);
if (STATUSES.includes(initial.get('status'))) $('status').value = initial.get('status');
if (initial.get('q')) $('q').value = initial.get('q').slice(0, 60);
let page = 1;
let timer;

try {
  const { doctors } = (await api.get('/admin/doctors?limit=50')).data;
  $('doctor').insertAdjacentHTML('beforeend', doctors.map((d) => `<option value="${esc(d._id)}">${esc(d.name)}</option>`).join(''));
} catch (_) { /* filter stays on "All doctors" */ }

async function load() {
  const params = new URLSearchParams({ page, limit: 12 });
  ['q', 'status', 'doctor', 'date'].forEach((k) => { const v = $(k).value.trim(); if (v) params.set(k, v); });
  try {
    const { appointments, pagination } = (await api.get(`/admin/appointments?${params}`)).data;
    if (!appointments.length) { results.innerHTML = stateBox('No appointments found', 'Try different filters.'); return; }
    results.innerHTML = `<div class="data-table-wrap"><table class="data-table"><caption class="visually-hidden">Appointments</caption>
      <thead><tr><th scope="col">Booking</th><th scope="col">When</th><th scope="col">Patient</th><th scope="col">Doctor</th><th scope="col">Status</th><th scope="col">Payment</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead>
      <tbody>${appointments.map((a) => `<tr>
        <td><span class="name">${esc(a.appointmentId)}</span><span class="sub">${esc(a.consultationType)}${a.tokenNumber ? ` &middot; token ${esc(a.tokenNumber)}` : ''}</span></td>
        <td>${esc(formatDate(a.appointmentDate))}<span class="sub">${esc(to12h(a.slotTime))}</span></td>
        <td>${esc(a.patient.name)}<span class="sub">${esc(a.patient.phone)}</span></td>
        <td>${esc(a.doctor.name)}<span class="sub">${esc(a.doctor.specialization)}</span></td>
        <td>${statusBadge(a.status)}${a.cancellationReason ? `<span class="sub">${esc(a.cancellationReason)}</span>` : ''}</td>
        <td>${paymentBadge(a.paymentStatus)}</td>
        <td>${CANCELLABLE.includes(a.status) ? `<button type="button" class="btn btn-danger-ghost" data-cancel="${esc(a._id)}" data-info="${esc(`${a.appointmentId} for ${a.patient.name} with ${a.doctor.name} on ${formatDate(a.appointmentDate)} at ${to12h(a.slotTime)}`)}">Cancel</button>` : ''}</td></tr>`).join('')}</tbody></table></div>
      ${pagerHtml(pagination)}`;
    bindPager(results, (step) => { page += step; load(); });
    results.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', () => cancel(b.dataset)));
  } catch (error) { results.innerHTML = stateBox('Could not load appointments', error.message); }
}

function cancel({ cancel: id, info }) {
  openCancelModal({
    summary: `${info}. The patient and the doctor will be told, and a paid demo payment is marked as refunded.`,
    title: 'Cancel this appointment?', label: 'Reason (the patient will see this)', confirmLabel: 'Yes, cancel it', keepLabel: 'Keep it', busyLabel: 'Cancelling...',
    onConfirm: async (reason) => { const res = await api.put(`/admin/appointments/${id}/cancel`, { reason }); showToast(res.message, 'success'); load(); },
  });
}

$('q').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { page = 1; load(); }, 300); });
['status', 'doctor', 'date'].forEach((k) => $(k).addEventListener('change', () => { page = 1; load(); }));
$('clear').addEventListener('click', () => { ['q', 'status', 'doctor', 'date'].forEach((k) => { $(k).value = ''; }); page = 1; load(); });
load();

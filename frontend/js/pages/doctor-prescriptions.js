import { requireRole } from '../core/guard.js';
import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { esc, stateBox } from '../core/ui.js';
import { downloadFile } from '../core/download.js';
import { formatDay } from '../core/dates.js';

const user = await requireRole('doctor');
mountLayout({ user, active: 'prescriptions' });
const root = document.getElementById('rx');
let page = 1;

async function load() {
  try {
    const { prescriptions, pagination } = (await api.get(`/prescriptions?page=${page}&limit=10`)).data;
    if (!prescriptions.length) { root.innerHTML = stateBox('No prescriptions yet', 'Open a confirmed appointment to write a prescription.', { href: PATHS.doctor.appointments, label: 'Appointments' }); return; }
    root.innerHTML = `<section class="panel">${prescriptions.map((p) => {
      const who = p.patient ? `${p.patient.firstName} ${p.patient.lastName}` : 'Patient';
      return `<div class="patient-row"><div><h2>${esc(who)}</h2>
        <p class="appt-meta mb-0">${esc(p.diagnosis)} &middot; ${esc(formatDay(p.createdAt))} &middot; ${esc(p.medicines.length)} ${p.medicines.length === 1 ? 'medicine' : 'medicines'} &middot; ${esc(p.prescriptionId)}</p></div>
        <div class="appt-actions" style="flex-direction:row;flex-wrap:wrap">
          ${p.appointment ? `<a class="btn btn-ghost btn-sm-brand" href="${PATHS.doctor.consultation}?id=${encodeURIComponent(p.appointment)}">Edit</a>` : ''}
          <button type="button" class="btn btn-brand btn-sm-brand" data-pdf="${esc(p._id)}" data-name="prescription-${esc(p.prescriptionId)}.pdf">PDF</button></div></div>`;
    }).join('')}
      ${pagination.pages > 1 ? `<nav class="pager mt-3" aria-label="Pages"><button class="btn btn-ghost" id="prev" ${page <= 1 ? 'disabled' : ''}>Previous</button><span>Page ${pagination.page} of ${pagination.pages}</span><button class="btn btn-ghost" id="next" ${page >= pagination.pages ? 'disabled' : ''}>Next</button></nav>` : ''}</section>`;
    root.querySelectorAll('[data-pdf]').forEach((b) => b.addEventListener('click', () => downloadFile(`/api/prescriptions/${encodeURIComponent(b.dataset.pdf)}/pdf`, b.dataset.name)));
    document.getElementById('prev')?.addEventListener('click', () => { page -= 1; load(); });
    document.getElementById('next')?.addEventListener('click', () => { page += 1; load(); });
  } catch (error) { root.innerHTML = stateBox('Could not load prescriptions', error.message); }
}
load();

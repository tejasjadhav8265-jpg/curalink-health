import { requireRole } from '../core/guard.js';
import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { esc, stateBox } from '../core/ui.js';
import { downloadFile } from '../core/download.js';
import { formatDay, formatDate } from '../core/dates.js';

const user = await requireRole('patient');
mountLayout({ user, active: 'records' });
const root = document.getElementById('rx');
let page = 1;

const card = (p, open) => {
  const d = p.doctor || {};
  return `<details class="rx" ${open ? 'open' : ''}>
    <summary><span><strong>${esc(p.diagnosis)}</strong><span class="when">${esc(d.name || 'Doctor')} &middot; ${esc(formatDay(p.createdAt))} &middot; ${esc(p.medicines.length)} ${p.medicines.length === 1 ? 'medicine' : 'medicines'}</span></span>
      <span class="btn btn-ghost btn-sm-brand" aria-hidden="true">View</span></summary>
    <div class="rx-body">
      <p class="mt-3 mb-1 text-muted small">${esc(d.specialization || '')}${d.qualification ? ` &middot; ${esc(d.qualification)}` : ''} &middot; ID ${esc(p.prescriptionId)}</p>
      <div class="table-responsive"><table class="med-table"><thead><tr><th scope="col">Medicine</th><th scope="col">Dosage</th><th scope="col">How often</th><th scope="col">For</th></tr></thead><tbody>
        ${p.medicines.map((m) => `<tr><td><strong>${esc(m.name)}</strong>${m.instructions ? `<br><span class="small text-muted">${esc(m.instructions)}</span>` : ''}</td><td>${esc(m.dosage)}</td><td>${esc(m.frequency)}</td><td>${esc(m.duration)}</td></tr>`).join('')}
      </tbody></table></div>
      ${p.advice ? `<p class="mb-2"><strong>Advice:</strong> ${esc(p.advice)}</p>` : ''}
      ${p.followUpDate ? `<p class="mb-2"><strong>Follow-up:</strong> ${esc(formatDate(p.followUpDate))}</p>` : ''}
      <button type="button" class="btn btn-brand btn-sm-brand mt-2" data-pdf="${esc(p._id)}" data-name="prescription-${esc(p.prescriptionId)}.pdf"><i class="fa-solid fa-download me-2" aria-hidden="true"></i>Download PDF</button>
    </div></details>`;
};

async function load() {
  try {
    const { prescriptions, pagination } = (await api.get(`/prescriptions?page=${page}&limit=8`)).data;
    if (!prescriptions.length) { root.innerHTML = stateBox('No prescriptions yet', 'When a doctor writes a prescription after your visit, it will appear here.', { href: PATHS.patient.appointments, label: 'My appointments' }); return; }
    root.innerHTML = `${prescriptions.map((p, i) => card(p, page === 1 && i === 0 && prescriptions.length === 1)).join('')}
      ${pagination.pages > 1 ? `<nav class="pager mt-3" aria-label="Pages"><button class="btn btn-ghost" id="prev" ${page <= 1 ? 'disabled' : ''}>Previous</button><span>Page ${pagination.page} of ${pagination.pages}</span><button class="btn btn-ghost" id="next" ${page >= pagination.pages ? 'disabled' : ''}>Next</button></nav>` : ''}`;
    root.querySelectorAll('[data-pdf]').forEach((b) => b.addEventListener('click', () => downloadFile(`/api/prescriptions/${encodeURIComponent(b.dataset.pdf)}/pdf`, b.dataset.name)));
    document.getElementById('prev')?.addEventListener('click', () => { page -= 1; load(); });
    document.getElementById('next')?.addEventListener('click', () => { page += 1; load(); });
  } catch (error) { root.innerHTML = stateBox('Could not load your prescriptions', error.message); }
}
load();

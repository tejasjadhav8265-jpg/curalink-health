import { requireRole } from '../core/guard.js';
import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { patientLine } from '../components/doctor-appt-card.js';
import { esc, stateBox } from '../core/ui.js';
import { formatDate } from '../core/dates.js';

const user = await requireRole('doctor');
mountLayout({ user, active: 'patients' });
const root = document.getElementById('list');

root.innerHTML = `<div class="panel">
  <div class="field mb-3"><label for="q">Search by name</label><input class="form-control" id="q" type="search" maxlength="60" placeholder="Type a patient's name" autocomplete="off"></div>
  <div id="results" aria-live="polite"><p class="text-muted">Loading...</p></div></div>`;

const results = document.getElementById('results');
let page = 1;
let timer;

async function load() {
  const q = document.getElementById('q').value.trim();
  try {
    const { patients, pagination } = (await api.get(`/doctor/patients?page=${page}&limit=10${q ? `&q=${encodeURIComponent(q)}` : ''}`)).data;
    if (!patients.length) { results.innerHTML = stateBox(q ? 'No patients match that name' : 'No patients yet', q ? 'Check the spelling or clear the search.' : 'Patients appear here after they book with you.'); return; }
    results.innerHTML = `${patients.map((p) => `<div class="patient-row">
      <div><h2><a href="${PATHS.doctor.patientDetails}?id=${encodeURIComponent(p._id)}">${esc(p.name)}</a></h2>
        <p class="appt-meta mb-0">${esc(patientLine(p))}${p.city ? ` &middot; ${esc(p.city)}` : ''} &middot; ${esc(p.visits)} completed ${p.visits === 1 ? 'visit' : 'visits'}${p.lastVisit ? ` &middot; last seen ${esc(formatDate(p.lastVisit))}` : ''}${p.nextVisit ? ` &middot; next ${esc(formatDate(p.nextVisit))}` : ''}</p></div>
      <a class="btn btn-ghost btn-sm-brand" href="${PATHS.doctor.patientDetails}?id=${encodeURIComponent(p._id)}">View</a></div>`).join('')}
      ${pagination.pages > 1 ? `<nav class="pager mt-3" aria-label="Pages"><button class="btn btn-ghost" id="prev" ${page <= 1 ? 'disabled' : ''}>Previous</button><span>Page ${pagination.page} of ${pagination.pages}</span><button class="btn btn-ghost" id="next" ${page >= pagination.pages ? 'disabled' : ''}>Next</button></nav>` : ''}`;
    document.getElementById('prev')?.addEventListener('click', () => { page -= 1; load(); });
    document.getElementById('next')?.addEventListener('click', () => { page += 1; load(); });
  } catch (error) { results.innerHTML = stateBox('Could not load patients', error.message); }
}
document.getElementById('q').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { page = 1; load(); }, 300); });
load();

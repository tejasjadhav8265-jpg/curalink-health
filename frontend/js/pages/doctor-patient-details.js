import { requireRole } from '../core/guard.js';
import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { patientLine } from '../components/doctor-appt-card.js';
import { esc, statusBadge, stateBox } from '../core/ui.js';
import { downloadFile } from '../core/download.js';
import { formatDate, formatDay, to12h } from '../core/dates.js';

const user = await requireRole('doctor');
mountLayout({ user, active: 'patients' });
const id = new URLSearchParams(window.location.search).get('id');
const root = document.getElementById('detail');
const size = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const tags = (list, warn) => (list.length ? `<ul class="tag-list">${list.map((x) => `<li class="${warn ? 'warn' : ''}">${esc(x)}</li>`).join('')}</ul>` : '<p class="text-muted mb-0">None listed.</p>');

if (!id) {
  root.innerHTML = stateBox('No patient selected', 'Choose a patient from your list.', { href: PATHS.doctor.patients, label: 'My patients' });
} else {
  try {
    const d = (await api.get(`/doctor/patients/${encodeURIComponent(id)}`)).data;
    const p = d.patient;
    document.getElementById('page-title').textContent = p.name;
    document.getElementById('sub').textContent = patientLine(p);
    root.innerHTML = `
    <p class="mb-3"><a href="${PATHS.doctor.patients}">&larr; My patients</a></p>
    <div class="two-col">
      <div class="stack">
        <section class="panel"><h2 class="h5">Contact</h2><ul class="fact-list">
          <li><span>Phone</span><span>${esc(p.phone || '-')}</span></li><li><span>City</span><span>${esc(p.city || '-')}</span></li>
          <li><span>Emergency contact</span><span>${esc(p.emergencyContact || '-')}</span></li></ul></section>
        ${d.fullAccess ? `<section class="panel"><h2 class="h5">Health summary</h2>
          <p class="mb-2"><strong>Blood group:</strong> ${esc(d.record.bloodGroup || 'Not given')}</p>
          <p class="mb-1"><strong>Allergies</strong></p>${tags(d.record.allergies, true)}
          <p class="mb-1 mt-3"><strong>Ongoing conditions</strong></p>${tags(d.record.chronicConditions, false)}
          ${d.record.notes ? `<p class="mt-3 mb-0"><strong>Notes:</strong> ${esc(d.record.notes)}</p>` : ''}</section>
        <section class="panel"><h2 class="h5">Reports</h2>
          ${d.reports.length ? d.reports.map((x) => `<div class="report-row"><span class="notif-icon" aria-hidden="true"><i class="fa-regular fa-file-lines"></i></span>
            <div><h3>${esc(x.fileName)}</h3><span class="when">${esc(x.fileType)} &middot; ${esc(size(x.size))} &middot; ${esc(formatDay(x.uploadDate))}</span></div>
            <div class="report-actions"><button type="button" class="btn btn-ghost btn-sm-brand" data-dl="${esc(x._id)}" data-name="${esc(x.fileName)}">Download</button></div></div>`).join('') : '<p class="text-muted mb-0">No reports uploaded.</p>'}</section>`
        : '<section class="panel"><h2 class="h5">Health record</h2><p class="text-muted mb-0">The health summary and reports are shown once you confirm an appointment with this patient.</p></section>'}
      </div>
      <div class="stack">
        <section class="panel"><h2 class="h5">Visits with you</h2>
          ${d.history.length ? `<ul class="mini-list">${d.history.map((a) => `<li><a href="${PATHS.doctor.consultation}?id=${encodeURIComponent(a._id)}">${esc(formatDate(a.appointmentDate))}, ${esc(to12h(a.slotTime))}</a> ${statusBadge(a.status)}${a.reason ? `<br><span class="when">${esc(a.reason)}</span>` : ''}</li>`).join('')}</ul>` : '<p class="text-muted mb-0">No visits.</p>'}</section>
        <section class="panel"><h2 class="h5">Prescriptions you wrote</h2>
          ${d.prescriptions.length ? `<ul class="mini-list">${d.prescriptions.map((x) => `<li><strong>${esc(x.diagnosis)}</strong><br><span class="when">${esc(formatDay(x.createdAt))} &middot; ${esc(x.medicineCount)} ${x.medicineCount === 1 ? 'medicine' : 'medicines'}</span>
            <br><button type="button" class="link-btn" data-pdf="${esc(x._id)}" data-name="prescription-${esc(x.prescriptionId)}.pdf">Download PDF</button></li>`).join('')}</ul>` : '<p class="text-muted mb-0">None yet.</p>'}</section>
        ${d.fullAccess ? `<section class="panel"><h2 class="h5">Your notes</h2>
          ${d.notes.length ? `<ul class="mini-list">${d.notes.map((n) => `<li>${esc(n.note)}<br><span class="when">${esc(formatDay(n.createdAt))}</span></li>`).join('')}</ul>` : '<p class="text-muted mb-0">No notes yet.</p>'}</section>` : ''}
      </div>
    </div>`;
    root.querySelectorAll('[data-dl]').forEach((b) => b.addEventListener('click', () => downloadFile(`/api/doctor/patients/${encodeURIComponent(id)}/reports/${encodeURIComponent(b.dataset.dl)}/download`, b.dataset.name)));
    root.querySelectorAll('[data-pdf]').forEach((b) => b.addEventListener('click', () => downloadFile(`/api/prescriptions/${encodeURIComponent(b.dataset.pdf)}/pdf`, b.dataset.name)));
  } catch (error) {
    root.innerHTML = stateBox(error.status === 404 ? 'Patient not found' : 'Could not load this patient', error.message, { href: PATHS.doctor.patients, label: 'My patients' });
  }
}

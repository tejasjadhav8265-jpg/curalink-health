import { requireRole } from '../core/guard.js';
import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { confirmModal } from '../components/confirm-modal.js';
import { esc, setFieldError, setLoading, showNotice, stateBox } from '../core/ui.js';
import { showToast } from '../core/toast.js';
import { downloadFile } from '../core/download.js';
import { formatDay } from '../core/dates.js';

const user = await requireRole('patient');
mountLayout({ user, active: 'records' });
const root = document.getElementById('records');

const TYPES = ['Blood Test', 'X-Ray', 'MRI', 'CT Scan', 'Prescription', 'Discharge Summary', 'Other'];
const GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const MAX_MB = 5;
const ALLOWED_EXT = ['pdf', 'png', 'jpg', 'jpeg'];
const toList = (text) => [...new Set(text.split(/[\n,]/).map((s) => s.trim()).filter(Boolean))];
const size = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const icon = (mime) => (mime === 'application/pdf' ? 'fa-file-pdf' : 'fa-file-image');

function shell(record) {
  root.innerHTML = `
  <div class="two-col">
    <div class="stack">
      <section class="panel">
        <h2 class="h5">Health summary</h2>
        <p class="text-muted small">Shared with your doctor only when you choose to show it. Keep it short and accurate.</p>
        <div id="sum-notice" aria-live="polite"></div>
        <form id="sum-form" novalidate>
          <div class="field"><label for="bloodGroup">Blood group <span class="optional">(optional)</span></label>
            <select class="form-select" id="bloodGroup"><option value="">Not sure</option>${GROUPS.map((g) => `<option ${g === record.bloodGroup ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
          <div class="field"><label for="allergies">Allergies <span class="optional">(one per line)</span></label>
            <textarea class="form-control" id="allergies" rows="3" placeholder="For example: Penicillin">${esc(record.allergies.join('\n'))}</textarea>
            <div class="field-error" id="allergies-error" hidden></div></div>
          <div class="field"><label for="chronic">Ongoing conditions <span class="optional">(one per line)</span></label>
            <textarea class="form-control" id="chronic" rows="3" placeholder="For example: Asthma">${esc(record.chronicConditions.join('\n'))}</textarea>
            <div class="field-error" id="chronic-error" hidden></div></div>
          <div class="field"><label for="notes">Notes <span class="optional">(optional)</span></label>
            <textarea class="form-control" id="notes" rows="3" maxlength="2000">${esc(record.notes)}</textarea></div>
          <button class="btn btn-brand" type="submit" id="sum-save">Save summary</button>
        </form>
      </section>

      <section class="panel">
        <h2 class="h5">Upload a report</h2>
        <p class="text-muted small">PDF, JPG or PNG, up to ${MAX_MB} MB. Only you can see your reports.</p>
        <div id="up-notice" aria-live="polite"></div>
        <form id="up-form" novalidate>
          <div class="field"><label for="file">File</label><input class="form-control" type="file" id="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"><div class="field-error" id="file-error" hidden></div></div>
          <div class="field"><label for="fileType">Report type</label>
            <select class="form-select" id="fileType"><option value="">Select</option>${TYPES.map((t) => `<option>${t}</option>`).join('')}</select><div class="field-error" id="fileType-error" hidden></div></div>
          <div class="field"><label for="description">Description <span class="optional">(optional)</span></label><input class="form-control" id="description" maxlength="500" placeholder="For example: Blood test from October"></div>
          <button class="btn btn-brand" type="submit" id="up-save">Upload report</button>
        </form>
      </section>
    </div>

    <section class="panel">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2"><h2 class="h5 mb-0">My reports</h2>
        <a class="btn btn-ghost btn-sm-brand" href="${PATHS.patient.prescriptions}">View prescriptions</a></div>
      <div id="report-list" aria-live="polite"><p class="text-muted">Loading reports...</p></div>
    </section>
  </div>`;

  // ----- health summary -----
  const sform = document.getElementById('sum-form');
  sform.addEventListener('submit', async (e) => {
    e.preventDefault();
    const notice = document.getElementById('sum-notice'); notice.innerHTML = '';
    const allergies = toList(sform.allergies.value); const chronicConditions = toList(sform.chronic.value);
    const bad = (list) => list.length > 20 ? 'Please list at most 20 items.' : (list.some((x) => x.length > 60) ? 'Each item can be up to 60 characters.' : '');
    setFieldError(sform.allergies, bad(allergies)); setFieldError(sform.chronic, bad(chronicConditions));
    if (bad(allergies) || bad(chronicConditions)) return;
    const btn = document.getElementById('sum-save'); setLoading(btn, true, 'Saving...');
    try {
      const res = await api.put('/patients/record', { bloodGroup: sform.bloodGroup.value, allergies, chronicConditions, notes: sform.notes.value.trim() });
      showNotice(notice, res.message, 'success');
    } catch (error) { showNotice(notice, (error.errors && error.errors[0] && error.errors[0].message) || error.message, 'error'); }
    setLoading(btn, false);
  });

  // ----- upload -----
  const uform = document.getElementById('up-form');
  uform.addEventListener('input', (e) => { if (e.target.id) setFieldError(e.target, ''); });
  uform.addEventListener('submit', async (e) => {
    e.preventDefault();
    const notice = document.getElementById('up-notice'); notice.innerHTML = '';
    const file = uform.file.files[0];
    const ext = file ? file.name.split('.').pop().toLowerCase() : '';
    const fileMsg = !file ? 'Please choose a file to upload.' : !ALLOWED_EXT.includes(ext) ? 'Only PDF, JPG and PNG files can be uploaded.' : file.size > MAX_MB * 1048576 ? `This file is larger than ${MAX_MB} MB.` : '';
    const typeMsg = uform.fileType.value ? '' : 'Please select a report type.';
    setFieldError(uform.file, fileMsg); setFieldError(uform.fileType, typeMsg);
    if (fileMsg || typeMsg) return;
    const btn = document.getElementById('up-save'); setLoading(btn, true, 'Uploading...');
    try {
      const fd = new FormData(); // text fields first, file last (the server reads them in this order)
      fd.append('fileType', uform.fileType.value);
      fd.append('description', uform.description.value.trim());
      fd.append('file', file);
      const response = await fetch('/api/reports', { method: 'POST', body: fd, credentials: 'same-origin' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'The upload failed. Please try again.');
      uform.reset();
      showToast('Report uploaded.', 'success');
      loadReports();
    } catch (error) { showNotice(notice, error.message, 'error'); }
    setLoading(btn, false);
  });
  loadReports();
}

async function loadReports() {
  const box = document.getElementById('report-list');
  try {
    const { reports } = (await api.get('/reports')).data;
    if (!reports.length) { box.innerHTML = stateBox('No reports yet', 'Upload a lab report, scan or discharge summary to keep it with you.'); return; }
    box.innerHTML = reports.map((r) => `<div class="report-row">
      <span class="notif-icon" aria-hidden="true"><i class="fa-regular ${icon(r.mimeType)}"></i></span>
      <div><h3>${esc(r.fileName)}</h3><span class="when">${esc(r.fileType)} &middot; ${esc(size(r.size))} &middot; ${esc(formatDay(r.uploadDate))}</span>${r.description ? `<br><span class="small">${esc(r.description)}</span>` : ''}</div>
      <div class="report-actions"><button type="button" class="btn btn-ghost btn-sm-brand" data-dl="${esc(r._id)}" data-name="${esc(r.fileName)}">Download</button>
        <button type="button" class="btn-danger-ghost" data-del="${esc(r._id)}" data-name="${esc(r.fileName)}">Delete</button></div></div>`).join('');
    box.querySelectorAll('[data-dl]').forEach((b) => b.addEventListener('click', () => downloadFile(`/api/reports/${encodeURIComponent(b.dataset.dl)}/download`, b.dataset.name)));
    box.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => confirmModal({
      title: 'Delete this report?', message: `${b.dataset.name} will be removed permanently.`,
      onConfirm: async () => { await api.del(`/reports/${encodeURIComponent(b.dataset.del)}`); showToast('Report deleted.', 'success'); loadReports(); },
    })));
  } catch (error) { box.innerHTML = stateBox('Could not load your reports', error.message); }
}

try { shell((await api.get('/patients/record')).data.record); } catch (error) { root.innerHTML = stateBox('Could not load your records', error.message); }

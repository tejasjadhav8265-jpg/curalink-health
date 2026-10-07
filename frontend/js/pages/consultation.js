import { requireRole } from '../core/guard.js';
import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { actionButtons, bindActions } from '../components/doctor-actions.js';
import { patientLine } from '../components/doctor-appt-card.js';
import { esc, statusBadge, setFieldError, setLoading, showNotice, stateBox } from '../core/ui.js';
import { showToast } from '../core/toast.js';
import { downloadFile } from '../core/download.js';
import { todayIST, formatDate, to12h, formatDay } from '../core/dates.js';

const user = await requireRole('doctor');
mountLayout({ user, active: 'appointments' });

const id = new URLSearchParams(window.location.search).get('id');
const root = document.getElementById('consult');
const size = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const emptyMed = () => ({ name: '', dosage: '', frequency: '', duration: '', instructions: '' });
let meds = [];

function healthPanel(d) {
  if (!d.fullAccess) return '<section class="panel"><h2 class="h5">Health record</h2><p class="text-muted mb-0">The patient\'s health summary and reports are shown after you confirm this appointment.</p></section>';
  const r = d.record;
  const tags = (list, warn) => (list.length ? `<ul class="tag-list">${list.map((x) => `<li class="${warn ? 'warn' : ''}">${esc(x)}</li>`).join('')}</ul>` : '<p class="text-muted mb-0">None listed.</p>');
  return `<section class="panel"><h2 class="h5">Health summary</h2>
      <p class="mb-2"><strong>Blood group:</strong> ${esc(r.bloodGroup || 'Not given')}</p>
      <p class="mb-1"><strong>Allergies</strong></p>${tags(r.allergies, true)}
      <p class="mb-1 mt-3"><strong>Ongoing conditions</strong></p>${tags(r.chronicConditions, false)}
      ${r.notes ? `<p class="mt-3 mb-0"><strong>Notes:</strong> ${esc(r.notes)}</p>` : ''}</section>
    <section class="panel"><h2 class="h5">Reports</h2>
      ${d.reports.length ? d.reports.map((x) => `<div class="report-row"><span class="notif-icon" aria-hidden="true"><i class="fa-regular fa-file-lines"></i></span>
        <div><h3>${esc(x.fileName)}</h3><span class="when">${esc(x.fileType)} &middot; ${esc(size(x.size))} &middot; ${esc(formatDay(x.uploadDate))}</span>${x.description ? `<br><span class="small">${esc(x.description)}</span>` : ''}</div>
        <div class="report-actions"><button type="button" class="btn btn-ghost btn-sm-brand" data-dl="${esc(x._id)}" data-name="${esc(x.fileName)}">Download</button></div></div>`).join('') : '<p class="text-muted mb-0">The patient has not uploaded any reports.</p>'}</section>`;
}

function medRows() {
  return meds.map((m, i) => `<div class="med-edit" data-row="${i}"><div class="row">
    <div class="col-md-6"><label class="form-label small" for="m-name-${i}">Medicine</label><input class="form-control" id="m-name-${i}" data-i="${i}" data-f="name" maxlength="100" value="${esc(m.name)}"></div>
    <div class="col-md-6"><label class="form-label small" for="m-dosage-${i}">Dosage</label><input class="form-control" id="m-dosage-${i}" data-i="${i}" data-f="dosage" maxlength="100" placeholder="1 tablet" value="${esc(m.dosage)}"></div>
    <div class="col-md-6"><label class="form-label small" for="m-freq-${i}">How often</label><input class="form-control" id="m-freq-${i}" data-i="${i}" data-f="frequency" maxlength="100" placeholder="Twice a day, after food" value="${esc(m.frequency)}"></div>
    <div class="col-md-6"><label class="form-label small" for="m-dur-${i}">For how long</label><input class="form-control" id="m-dur-${i}" data-i="${i}" data-f="duration" maxlength="100" placeholder="5 days" value="${esc(m.duration)}"></div>
    <div class="col-12"><label class="form-label small" for="m-ins-${i}">Instructions <span class="optional">(optional)</span></label><input class="form-control" id="m-ins-${i}" data-i="${i}" data-f="instructions" maxlength="200" value="${esc(m.instructions || '')}"></div>
    ${meds.length > 1 ? `<div class="col-12"><button type="button" class="link-btn danger" data-rm="${i}">Remove this medicine</button></div>` : ''}
  </div></div>`).join('');
}

function render(d) {
  const a = d.appointment;
  const canWrite = d.fullAccess;
  meds = d.prescription ? d.prescription.medicines.map((m) => ({ ...emptyMed(), ...m })) : [emptyMed()];
  document.getElementById('page-title').textContent = a.patient.name;
  document.getElementById('sub').textContent = `${formatDate(a.appointmentDate)} at ${to12h(a.slotTime)}`;
  const pid = a.patient._id;

  root.innerHTML = `
  <p class="mb-3"><a href="${PATHS.doctor.appointments}">&larr; Appointments</a></p>
  <div class="two-col">
    <div class="stack">
      <section class="panel">
        <div class="d-flex justify-content-between flex-wrap gap-2 mb-2"><h2 class="h5 mb-0">Appointment</h2>${statusBadge(a.status)}</div>
        <ul class="fact-list">
          <li><span>Patient</span><span>${esc(a.patient.name)}${patientLine(a.patient) ? `<br><span class="text-muted small">${esc(patientLine(a.patient))}</span>` : ''}</span></li>
          <li><span>Phone</span><span>${esc(a.patient.phone || '-')}</span></li>
          <li><span>Visit type</span><span>${a.consultationType === 'video' ? 'Video' : 'In-person'}</span></li>
          <li><span>Token</span><span>${esc(a.tokenNumber || '-')}</span></li>
          <li><span>Reason</span><span>${esc(a.reason || 'Not given')}</span></li>
        </ul>
        <div class="appt-actions mt-3" style="flex-direction:row;flex-wrap:wrap" id="act-box">${actionButtons(a)}</div>
        ${a.status === 'pending' || a.status === 'rescheduled' ? '<p class="small text-muted mt-3 mb-0">Confirm this appointment to unlock notes, the prescription and the health record.</p>' : ''}
        <p class="small mt-3 mb-0"><a href="${PATHS.doctor.patientDetails}?id=${encodeURIComponent(pid)}">Open full patient page</a></p>
      </section>
      ${healthPanel(d)}
    </div>

    <div class="stack">
      <section class="panel">
        <h2 class="h5">Consultation note</h2>
        ${canWrite ? `<div id="note-notice" aria-live="polite"></div>
        <form id="note-form" novalidate>
          <div class="field"><label for="symptoms">Symptoms <span class="optional">(optional)</span></label><textarea class="form-control" id="symptoms" rows="2" maxlength="2000">${esc(d.note ? d.note.symptoms : '')}</textarea></div>
          <div class="field"><label for="observations">Observations <span class="optional">(optional)</span></label><textarea class="form-control" id="observations" rows="2" maxlength="2000">${esc(d.note ? d.note.observations : '')}</textarea></div>
          <div class="field"><label for="note">Note</label><textarea class="form-control" id="note" rows="4" maxlength="4000">${esc(d.note ? d.note.note : '')}</textarea><div class="field-error" id="note-error" hidden></div></div>
          <p class="small text-muted">Only you can see this note. It is not shown to the patient.</p>
          <button class="btn btn-brand" type="submit" id="note-save">Save note</button>
        </form>` : '<p class="text-muted mb-0">Available once the appointment is confirmed.</p>'}
      </section>

      <section class="panel">
        <div class="d-flex justify-content-between flex-wrap gap-2 mb-2"><h2 class="h5 mb-0">Prescription</h2>
          ${d.prescription ? `<button type="button" class="btn btn-ghost btn-sm-brand" id="rx-pdf">Download PDF</button>` : ''}</div>
        ${canWrite ? `<div id="rx-notice" aria-live="polite"></div>
        <form id="rx-form" novalidate>
          <div class="field"><label for="diagnosis">Diagnosis</label><input class="form-control" id="diagnosis" maxlength="500" value="${esc(d.prescription ? d.prescription.diagnosis : '')}"><div class="field-error" id="diagnosis-error" hidden></div></div>
          <p class="form-label mb-2">Medicines</p>
          <div id="meds">${medRows()}</div>
          <div class="field-error mb-2" id="meds-error" hidden></div>
          <button type="button" class="btn btn-ghost btn-sm-brand mb-3" id="add-med" ${meds.length >= 15 ? 'disabled' : ''}>Add another medicine</button>
          <div class="field"><label for="advice">Advice <span class="optional">(optional)</span></label><textarea class="form-control" id="advice" rows="2" maxlength="1000">${esc(d.prescription ? d.prescription.advice : '')}</textarea></div>
          <div class="field"><label for="followUpDate">Follow-up date <span class="optional">(optional)</span></label><input class="form-control" type="date" id="followUpDate" min="${todayIST()}" value="${esc(d.prescription ? d.prescription.followUpDate : '')}"><div class="field-error" id="followUpDate-error" hidden></div></div>
          <button class="btn btn-brand" type="submit" id="rx-save">${d.prescription ? 'Update prescription' : 'Save prescription'}</button>
        </form>` : '<p class="text-muted mb-0">Available once the appointment is confirmed.</p>'}
      </section>
    </div>
  </div>`;

  root.querySelectorAll('[data-dl]').forEach((b) => b.addEventListener('click', () => downloadFile(`/api/doctor/patients/${encodeURIComponent(pid)}/reports/${encodeURIComponent(b.dataset.dl)}/download`, b.dataset.name)));
  document.getElementById('rx-pdf')?.addEventListener('click', () => downloadFile(`/api/prescriptions/${encodeURIComponent(d.prescription._id)}/pdf`, `prescription-${d.prescription.prescriptionId}.pdf`));
  if (canWrite) bindForms(d);
}

function bindMeds() {
  const box = document.getElementById('meds');
  box.addEventListener('input', (e) => { const t = e.target; if (t.dataset.f) meds[Number(t.dataset.i)][t.dataset.f] = t.value; document.getElementById('meds-error').hidden = true; });
  box.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { meds.splice(Number(b.dataset.rm), 1); redrawMeds(); }));
}
function redrawMeds() {
  document.getElementById('meds').innerHTML = medRows();
  document.getElementById('add-med').disabled = meds.length >= 15;
  bindMeds();
}

function bindForms(d) {
  const nform = document.getElementById('note-form');
  nform.addEventListener('submit', async (e) => {
    e.preventDefault();
    const notice = document.getElementById('note-notice'); notice.innerHTML = '';
    const note = nform.note.value.trim();
    setFieldError(nform.note, note ? '' : 'Please write a consultation note.');
    if (!note) { nform.note.focus(); return; }
    const btn = document.getElementById('note-save'); setLoading(btn, true, 'Saving...');
    try {
      const res = await api.put(`/doctor/appointments/${encodeURIComponent(id)}/consultation`, { symptoms: nform.symptoms.value.trim(), observations: nform.observations.value.trim(), note });
      showNotice(notice, res.message, 'success');
    } catch (error) { showNotice(notice, (error.errors && error.errors[0] && error.errors[0].message) || error.message, 'error'); }
    setLoading(btn, false);
  });

  const rform = document.getElementById('rx-form');
  bindMeds();
  document.getElementById('add-med').addEventListener('click', () => { if (meds.length < 15) { meds.push(emptyMed()); redrawMeds(); } });
  rform.addEventListener('input', (e) => { if (e.target.id) setFieldError(e.target, ''); });
  rform.addEventListener('submit', async (e) => {
    e.preventDefault();
    const notice = document.getElementById('rx-notice'); notice.innerHTML = '';
    const diagnosis = rform.diagnosis.value.trim();
    setFieldError(rform.diagnosis, diagnosis ? '' : 'Please enter the diagnosis.');
    const medErr = document.getElementById('meds-error');
    const incomplete = meds.some((m) => !m.name.trim() || !m.dosage.trim() || !m.frequency.trim() || !m.duration.trim());
    medErr.textContent = incomplete ? 'Please fill in the name, dosage, how often and how long for every medicine.' : '';
    medErr.hidden = !incomplete;
    const fu = rform.followUpDate.value;
    const fuBad = fu && fu < todayIST();
    setFieldError(rform.followUpDate, fuBad ? 'Please choose a follow-up date that is today or later.' : '');
    if (!diagnosis) { rform.diagnosis.focus(); return; }
    if (incomplete || fuBad) return;

    const body = { diagnosis, medicines: meds.map((m) => ({ name: m.name.trim(), dosage: m.dosage.trim(), frequency: m.frequency.trim(), duration: m.duration.trim(), instructions: (m.instructions || '').trim() })), advice: rform.advice.value.trim(), followUpDate: fu };
    const btn = document.getElementById('rx-save'); setLoading(btn, true, 'Saving...');
    try {
      const res = d.prescription ? await api.put(`/prescriptions/${encodeURIComponent(d.prescription._id)}`, body) : await api.post('/prescriptions', { appointmentId: id, ...body });
      showToast(res.message, 'success');
      await load();
      return;
    } catch (error) { showNotice(notice, (error.errors && error.errors[0] && error.errors[0].message) || error.message, 'error'); }
    setLoading(btn, false);
  });
}

async function load() {
  try { render((await api.get(`/doctor/appointments/${encodeURIComponent(id)}`)).data); }
  catch (error) { root.innerHTML = stateBox(error.status === 404 ? 'Appointment not found' : 'Could not load this consultation', error.message, { href: PATHS.doctor.appointments, label: 'Appointments' }); }
}

if (!id) root.innerHTML = stateBox('No appointment selected', 'Open one from your appointments.', { href: PATHS.doctor.appointments, label: 'Appointments' });
else { bindActions(root, load); load(); }

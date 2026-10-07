import { requireRole } from '../core/guard.js';
import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { esc, setFieldError, setLoading, showNotice, stateBox, bindPasswordToggles } from '../core/ui.js';
import { showToast } from '../core/toast.js';

const user = await requireRole('admin');
mountLayout({ user, active: 'doctors' });
const root = document.getElementById('root');
const id = new URLSearchParams(window.location.search).get('id');
const editing = Boolean(id);
document.getElementById('page-title').textContent = editing ? 'Edit doctor' : 'Add doctor';

const input = (name, label, { type = 'text', required = true, max = 80, hint = '', attrs = '' } = {}) => `
  <div class="field"><label for="${name}">${label}${required ? '' : ' <span class="optional">(optional)</span>'}</label>
    <input class="form-control" id="${name}" name="${name}" type="${type}" maxlength="${max}" ${attrs}>
    ${hint ? `<div class="help">${hint}</div>` : ''}<div class="field-error" id="${name}-error" hidden></div></div>`;
const area = (name, label, hint, rows = 3, max = 3000) => `
  <div class="field"><label for="${name}">${label} <span class="optional">(optional)</span></label>
    <textarea class="form-control" id="${name}" name="${name}" rows="${rows}" maxlength="${max}"></textarea>
    <div class="help">${hint}</div><div class="field-error" id="${name}-error" hidden></div></div>`;

let departments = [];
let doctor = null;
try {
  departments = (await api.get('/admin/departments')).data.departments;
  if (editing) doctor = (await api.get(`/admin/doctors/${encodeURIComponent(id)}`)).data.doctor;
} catch (error) { root.innerHTML = stateBox('Could not open this page', error.message, { href: PATHS.admin.doctors, label: 'Back to doctors' }); throw error; }

root.innerHTML = `<form class="panel" id="form" novalidate>
  <div id="notice" tabindex="-1"></div>
  <div class="form-section"><h2>${editing ? 'Login' : 'Login for the doctor'}</h2><div class="row g-3">
    <div class="col-md-6">${input('email', 'Email', { type: 'email', max: 254, attrs: `autocomplete="off" ${editing ? 'readonly' : ''}`, hint: editing ? 'The email is the doctor\'s login and cannot be changed here.' : 'The doctor logs in with this email.' })}</div>
    ${editing ? '' : `<div class="col-md-6"><div class="field"><label for="password">Starting password</label>
      <div class="input-group"><input class="form-control" id="password" name="password" type="password" maxlength="72" autocomplete="new-password"><button class="btn btn-ghost pw-toggle" type="button" data-target="password" aria-label="Show password"><i class="fa-regular fa-eye" aria-hidden="true"></i></button></div>
      <div class="help">At least 8 characters with a capital letter, a small letter and a number. Tell the doctor to keep it safe.</div><div class="field-error" id="password-error" hidden></div></div></div>`}
  </div></div>
  <div class="form-section"><h2>Profile</h2><div class="row g-3">
    <div class="col-md-6">${input('name', 'Full name', { hint: '"Dr." is added automatically.' })}</div>
    <div class="col-md-6">${input('phone', 'Mobile number', { max: 15, attrs: 'inputmode="tel"', hint: '10-digit Indian mobile number.' })}</div>
    <div class="col-md-6">${input('specialization', 'Specialization', { hint: 'For example: Cardiologist' })}</div>
    <div class="col-md-6"><div class="field"><label for="department">Department</label><select class="form-select" id="department" name="department"><option value="">Choose a department</option>
      ${departments.map((d) => `<option value="${esc(d._id)}">${esc(d.name)}${d.status === 'inactive' ? ' (inactive)' : ''}</option>`).join('')}</select><div class="field-error" id="department-error" hidden></div></div></div>
    <div class="col-md-6">${input('qualification', 'Qualification', { required: false, max: 150, hint: 'For example: MBBS, MD' })}</div>
    <div class="col-md-3">${input('experience', 'Experience (years)', { type: 'number', attrs: 'min="0" max="70" inputmode="numeric"' })}</div>
    <div class="col-md-3"><div class="field"><label for="gender">Gender <span class="optional">(optional)</span></label><select class="form-select" id="gender" name="gender"><option value="">Not set</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select><div class="field-error" id="gender-error" hidden></div></div></div>
    <div class="col-md-6">${input('registrationNumber', 'Medical registration number', { max: 40 })}</div>
    <div class="col-md-6">${input('languages', 'Languages', { required: false, max: 200, hint: 'Separate with commas: English, Hindi, Marathi' })}</div>
  </div></div>
  <div class="form-section"><h2>Where and how they see patients</h2><div class="row g-3">
    <div class="col-md-4">${input('location', 'City')}</div>
    <div class="col-md-4">${input('branch', 'Hospital branch', { required: false })}</div>
    <div class="col-md-4">${input('consultationFee', 'Consultation fee (₹)', { type: 'number', attrs: 'min="0" max="100000" inputmode="numeric"' })}</div>
    <div class="col-12"><div class="field mb-0"><label id="ct-label">Visit types</label>
      <div class="check-row" id="consultationTypes" role="group" aria-labelledby="ct-label">
        <label><input type="checkbox" name="consultationTypes" value="in-person"> In-person</label>
        <label><input type="checkbox" name="consultationTypes" value="video"> Video</label></div>
      <div class="field-error" id="consultationTypes-error" hidden></div></div></div>
  </div></div>
  <div class="form-section"><h2>About</h2>
    ${area('about', 'About the doctor', 'A short paragraph shown on the doctor\'s page.', 4)}
    ${area('conditionsTreated', 'Conditions treated', 'Separate with commas. Patients can search by these.', 2, 1200)}
    ${area('procedures', 'Procedures', 'Separate with commas.', 2, 1200)}
    ${input('profileImage', 'Photo link', { required: false, max: 300, hint: 'Leave empty to use the default picture. Must start with /images/ or https://' })}
  </div>
  <div class="form-actions"><button class="btn btn-brand" type="submit" id="save">${editing ? 'Save changes' : 'Add doctor'}</button><a class="btn btn-ghost" href="${PATHS.admin.doctors}">Cancel</a></div>
</form>`;
bindPasswordToggles(root);

const form = document.getElementById('form');
const f = (name) => form.elements[name];
const NAMES = ['email', 'password', 'name', 'phone', 'specialization', 'department', 'qualification', 'experience', 'gender', 'registrationNumber', 'languages', 'location', 'branch', 'consultationFee', 'about', 'conditionsTreated', 'procedures', 'profileImage'];
const toList = (text) => text.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);

if (doctor) {
  NAMES.forEach((n) => { if (f(n) && doctor[n] !== undefined && doctor[n] !== null) f(n).value = Array.isArray(doctor[n]) ? doctor[n].join(', ') : doctor[n]; });
  form.querySelectorAll('input[name="consultationTypes"]').forEach((c) => { c.checked = (doctor.consultationTypes || []).includes(c.value); });
  if (doctor.department) f('department').value = String(doctor.department);
  if (doctor.profileImage === '/images/doctor-placeholder.svg') f('profileImage').value = '';
} else {
  form.querySelector('input[value="in-person"]').checked = true;
}

const errorTarget = (field) => (field === 'consultationTypes' || field.startsWith('consultationTypes.') ? document.getElementById('consultationTypes') : f(field));
const clearErrors = () => { [...NAMES, 'consultationTypes'].forEach((n) => { const t = errorTarget(n); if (t && t.id) setFieldError(t, ''); }); };

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors();
  const notice = document.getElementById('notice');
  notice.innerHTML = '';
  const body = {
    name: f('name').value.trim(), phone: f('phone').value.trim(), specialization: f('specialization').value.trim(), department: f('department').value,
    qualification: f('qualification').value.trim(), experience: f('experience').value === '' ? '' : Number(f('experience').value), gender: f('gender').value,
    languages: toList(f('languages').value), registrationNumber: f('registrationNumber').value.trim(), location: f('location').value.trim(), branch: f('branch').value.trim(),
    consultationFee: f('consultationFee').value === '' ? '' : Number(f('consultationFee').value), about: f('about').value.trim(),
    conditionsTreated: toList(f('conditionsTreated').value), procedures: toList(f('procedures').value),
    consultationTypes: [...form.querySelectorAll('input[name="consultationTypes"]:checked')].map((c) => c.value), profileImage: f('profileImage').value.trim(),
  };
  if (!editing) { body.email = f('email').value.trim(); body.password = f('password').value; }
  const button = document.getElementById('save');
  setLoading(button, true, 'Saving...');
  try {
    const res = editing ? await api.put(`/admin/doctors/${encodeURIComponent(id)}`, body) : await api.post('/admin/doctors', body);
    showToast(res.message, 'success');
    window.location.href = PATHS.admin.doctors;
  } catch (error) {
    setLoading(button, false);
    let first = null;
    (error.errors || []).forEach((e) => { const t = errorTarget(e.field); if (t && t.id) { setFieldError(t, e.message); first = first || t; } });
    showNotice(notice, (error.errors && error.errors[0] && error.errors[0].message) || error.message, 'error');
    (first || notice).focus();
  }
});

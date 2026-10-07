import { requireRole } from '../core/guard.js';
import { api } from '../core/api.js';
import { INDIAN_STATES } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { rules } from '../core/validators.js';
import { esc, setFieldError, setLoading, bindPasswordToggles, showNotice, stateBox } from '../core/ui.js';
import { showToast } from '../core/toast.js';

const user = await requireRole('patient');
mountLayout({ user, active: 'profile' });
const root = document.getElementById('profile');

const field = (id, label, input, extra = '') => `<div class="field"><label for="${id}">${label}</label>${input}<div class="field-error" id="${id}-error" hidden></div>${extra}</div>`;
const mobile = (id, label, value, optional) => field(id, `${label}${optional ? ' <span class="optional">(optional)</span>' : ''}`,
  `<div class="input-group"><span class="input-group-text" aria-hidden="true">+91</span><input class="form-control" type="tel" inputmode="numeric" id="${id}" name="${id}" maxlength="10" value="${esc(value)}"></div>`);

function render(p) {
  root.innerHTML = `
  <div class="two-col">
    <section class="panel">
      <h2 class="h5">Personal details</h2>
      <div id="profile-notice" aria-live="polite"></div>
      <form id="profile-form" novalidate>
        <div class="row g-x-3">
          <div class="col-md-6">${field('firstName', 'First name', `<input class="form-control" id="firstName" name="firstName" maxlength="50" value="${esc(p.firstName)}" autocomplete="given-name">`)}</div>
          <div class="col-md-6">${field('lastName', 'Last name', `<input class="form-control" id="lastName" name="lastName" maxlength="50" value="${esc(p.lastName)}" autocomplete="family-name">`)}</div>
          <div class="col-md-6">${field('dob', 'Date of birth', `<input class="form-control" type="date" id="dob" name="dob" value="${esc(p.dob)}" max="${new Date().toISOString().slice(0, 10)}">`)}</div>
          <div class="col-md-6">${field('gender', 'Gender', `<select class="form-select" id="gender" name="gender">${[['', 'Select'], ['female', 'Female'], ['male', 'Male'], ['other', 'Other']].map(([v, l]) => `<option value="${v}" ${v === p.gender ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}</div>
          <div class="col-md-6">${field('email', 'Email', `<input class="form-control" id="email" value="${esc(p.email)}" disabled>`, '<p class="small text-muted mb-0">Email cannot be changed here.</p>')}</div>
          <div class="col-md-6">${mobile('phone', 'Mobile number', p.phone)}</div>
          <div class="col-12">${field('address', 'Address <span class="optional">(optional)</span>', `<input class="form-control" id="address" name="address" maxlength="300" value="${esc(p.address)}" autocomplete="street-address">`)}</div>
          <div class="col-md-6">${field('city', 'City', `<input class="form-control" id="city" name="city" maxlength="80" value="${esc(p.city)}" autocomplete="address-level2">`)}</div>
          <div class="col-md-6">${field('state', 'State', `<select class="form-select" id="state" name="state"><option value="">Select</option>${INDIAN_STATES.map((s) => `<option ${s === p.state ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>`)}</div>
          <div class="col-12">${mobile('emergencyContact', 'Emergency contact number', p.emergencyContact, true)}</div>
        </div>
        <button class="btn btn-brand" type="submit" id="save-profile">Save changes</button>
      </form>
    </section>

    <section class="panel">
      <h2 class="h5">Change password</h2>
      <div id="pw-notice" aria-live="polite"></div>
      <form id="pw-form" novalidate>
        ${['currentPassword:Current password:current-password', 'newPassword:New password:new-password', 'confirmPassword:Confirm new password:new-password'].map((x) => { const [id, label, ac] = x.split(':'); return field(id, label, `<div class="pw-wrap"><input class="form-control" type="password" id="${id}" name="${id}" autocomplete="${ac}"><button type="button" class="pw-toggle" data-target="${id}" aria-label="Show password" aria-pressed="false"><i class="fa-regular fa-eye" aria-hidden="true"></i></button></div>`); }).join('')}
        <p class="small text-muted">At least 8 characters with a lowercase letter, an uppercase letter and a number.</p>
        <button class="btn btn-ghost" type="submit" id="save-pw">Change password</button>
      </form>
    </section>
  </div>`;
  bindPasswordToggles(root);

  const pform = document.getElementById('profile-form');
  const checks = {
    firstName: (v) => rules.required(v, 'Please enter your first name.'),
    lastName: (v) => rules.required(v, 'Please enter your last name.'),
    dob: rules.dob,
    gender: (v) => rules.required(v, 'Please select your gender.'),
    phone: (v) => rules.mobile(v),
    city: (v) => rules.required(v, 'Please enter your city.'),
    state: (v) => rules.required(v, 'Please select your state.'),
    emergencyContact: (v) => (String(v).trim() ? rules.mobile(v) : ''),
  };
  pform.addEventListener('input', (e) => { if (e.target.name) setFieldError(e.target, ''); });
  pform.addEventListener('submit', async (e) => {
    e.preventDefault();
    const notice = document.getElementById('profile-notice'); notice.innerHTML = '';
    let first = null;
    Object.keys(checks).forEach((name) => { const input = pform.elements[name]; const msg = checks[name](input.value); setFieldError(input, msg); if (msg && !first) first = input; });
    if (first) { first.focus(); return; }
    const btn = document.getElementById('save-profile');
    setLoading(btn, true, 'Saving...');
    try {
      const body = Object.fromEntries(['firstName', 'lastName', 'dob', 'gender', 'phone', 'address', 'city', 'state', 'emergencyContact'].map((n) => [n, pform.elements[n].value.trim()]));
      const res = await api.put('/patients/profile', body);
      showNotice(notice, res.message, 'success');
      document.getElementById('page-title').textContent = 'My profile';
    } catch (error) { showNotice(notice, (error.errors && error.errors[0] && error.errors[0].message) || error.message, 'error'); }
    setLoading(btn, false);
  });

  const wform = document.getElementById('pw-form');
  wform.addEventListener('input', (e) => { if (e.target.name) setFieldError(e.target, ''); });
  wform.addEventListener('submit', async (e) => {
    e.preventDefault();
    const notice = document.getElementById('pw-notice'); notice.innerHTML = '';
    const f = wform.elements;
    const errs = [
      [f.currentPassword, rules.required(f.currentPassword.value, 'Please enter your current password.')],
      [f.newPassword, rules.password(f.newPassword.value) || (f.newPassword.value === f.currentPassword.value ? 'Your new password must be different from the current one.' : '')],
      [f.confirmPassword, rules.confirm(f.confirmPassword.value, f.newPassword.value)],
    ];
    let first = null;
    errs.forEach(([input, msg]) => { setFieldError(input, msg); if (msg && !first) first = input; });
    if (first) { first.focus(); return; }
    const btn = document.getElementById('save-pw');
    setLoading(btn, true, 'Changing...');
    try {
      const res = await api.put('/patients/password', { currentPassword: f.currentPassword.value, newPassword: f.newPassword.value });
      showNotice(notice, res.message, 'success');
      wform.reset();
      showToast('Password changed.', 'success');
    } catch (error) { showNotice(notice, (error.errors && error.errors[0] && error.errors[0].message) || error.message, 'error'); }
    setLoading(btn, false);
  });
}

try { render((await api.get('/patients/profile')).data.profile); } catch (error) { root.innerHTML = stateBox('Could not load your profile', error.message); }

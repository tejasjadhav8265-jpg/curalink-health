import { api } from '../core/api.js';
import { PATHS, INDIAN_STATES } from '../core/config.js';
import { rules, passwordChecks, passwordScore } from '../core/validators.js';
import { setFieldError, setLoading, bindPasswordToggles } from '../core/ui.js';
import { redirectIfLoggedIn } from '../core/guard.js';
import { showToast } from '../core/toast.js';

await redirectIfLoggedIn();
bindPasswordToggles();

const form = document.getElementById('register-form');
const button = document.getElementById('register-btn');
const formError = document.getElementById('form-error');

// Fill the state list and stop people choosing a birth date in the future.
const stateSelect = document.getElementById('state');
INDIAN_STATES.forEach((name) => stateSelect.add(new Option(name, name)));
const today = new Date();
document.getElementById('dob').max =
  `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

// Phone fields accept digits only.
['phone', 'emergencyContact'].forEach((id) => {
  const input = document.getElementById(id);
  input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, '').slice(0, 10); });
});

// One rule per field. Each returns an error message or ''.
const checks = {
  firstName: (v) => rules.required(v, 'Please enter your first name.'),
  lastName: (v) => rules.required(v, 'Please enter your last name.'),
  dob: (v) => rules.dob(v),
  gender: (v) => rules.required(v, 'Please select your gender.'),
  phone: (v) => rules.mobile(v),
  email: (v) => rules.email(v),
  city: (v) => rules.required(v, 'Please enter your city.'),
  state: (v) => rules.required(v, 'Please select your state.'),
  emergencyContact: (v) => (v ? rules.mobile(v) : ''),
  password: (v) => rules.password(v),
  confirmPassword: (v) => rules.confirm(v, form.elements.password.value),
};

function validateField(name) {
  const input = form.elements[name];
  const message = checks[name](input.value);
  setFieldError(input, message);
  return message;
}

// Check a field when the person leaves it (blur), and re-check live once it shows an error.
Object.keys(checks).forEach((name) => {
  const input = form.elements[name];
  input.addEventListener('blur', () => { if (input.value || input.classList.contains('is-invalid')) validateField(name); });
  input.addEventListener('input', () => { if (input.classList.contains('is-invalid')) validateField(name); });
});

// Live password strength meter and checklist.
const strength = document.getElementById('strength');
const strengthLabel = document.getElementById('strength-label');
const LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];
form.elements.password.addEventListener('input', () => {
  const value = form.elements.password.value;
  const result = passwordChecks(value);
  document.querySelectorAll('#pw-help li').forEach((li) => li.classList.toggle('ok', result[li.dataset.rule]));
  const score = value ? passwordScore(value) : 0;
  strength.dataset.score = String(score);
  strengthLabel.textContent = score ? `Password strength: ${LABELS[score]}` : '';
  if (form.elements.confirmPassword.value) validateField('confirmPassword');
});

// Show messages the server sent back (for example "email already exists").
function showServerError(error) {
  if (error.errors && error.errors.length) {
    let first = null;
    error.errors.forEach(({ field, message }) => {
      const input = form.elements[field];
      if (input) { setFieldError(input, message); first = first || input; }
    });
    if (first) { first.focus(); return; }
  }
  if (error.status === 409) {
    const target = /email/i.test(error.message) ? 'email' : 'phone';
    setFieldError(form.elements[target], error.message);
    form.elements[target].focus();
    return;
  }
  showToast(error.message, 'error');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  formError.hidden = true;

  let firstInvalid = null;
  Object.keys(checks).forEach((name) => {
    if (validateField(name) && !firstInvalid) firstInvalid = form.elements[name];
  });
  if (firstInvalid) { firstInvalid.focus(); return; }

  const payload = Object.fromEntries(new FormData(form).entries());
  setLoading(button, true, 'Creating account...');
  try {
    await api.post('/auth/register', payload);
    showToast('Account created. Taking you to the login page...', 'success');
    setTimeout(() => { window.location.href = `${PATHS.login}?registered=1`; }, 1200);
  } catch (error) {
    setLoading(button, false);
    showServerError(error);
  }
});

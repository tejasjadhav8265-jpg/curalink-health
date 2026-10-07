import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { rules } from '../core/validators.js';
import { setFieldError, setLoading, showNotice, bindPasswordToggles } from '../core/ui.js';
import { redirectIfLoggedIn } from '../core/guard.js';
import { showToast } from '../core/toast.js';

await redirectIfLoggedIn();
bindPasswordToggles();

const form = document.getElementById('login-form');
const button = document.getElementById('login-btn');
const formError = document.getElementById('form-error');
const params = new URLSearchParams(window.location.search);

// Messages coming from other pages (after registering, logging out, or being sent here to log in).
const notice = document.getElementById('page-notice');
if (params.get('registered')) showNotice(notice, 'Account created. Log in to continue.', 'success');
else if (params.get('loggedout')) showNotice(notice, 'You have been logged out.', 'info');
else if (params.get('next')) showNotice(notice, 'Please log in to continue.', 'info');

// Only allow going back to one of our own pages (blocks "open redirect" tricks).
function safeNext() {
  const next = params.get('next');
  return next && /^\/pages\/[a-z0-9\-\/]+\.html(\?[a-z0-9=&_%.\-]*)?$/i.test(next) ? next : null;
}

const checks = {
  email: (v) => rules.email(v),
  password: (v) => rules.required(v, 'Please enter your password.'),
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  formError.hidden = true;

  let firstInvalid = null;
  Object.keys(checks).forEach((name) => {
    const input = form.elements[name];
    const message = checks[name](input.value);
    setFieldError(input, message);
    if (message && !firstInvalid) firstInvalid = input;
  });
  if (firstInvalid) { firstInvalid.focus(); return; }

  setLoading(button, true, 'Logging in...');
  try {
    const response = await api.post('/auth/login', { email: form.email.value.trim(), password: form.password.value });
    window.location.href = safeNext() || response.data.redirectTo || PATHS.home;
  } catch (error) {
    setLoading(button, false);
    if (error.status === 401 || error.status === 400) {
      formError.textContent = error.message;
      formError.hidden = false;
    } else {
      showToast(error.message, 'error');
    }
  }
});

// Clear a field's error as soon as the person starts correcting it.
form.addEventListener('input', (event) => { if (event.target.name) setFieldError(event.target, ''); });

// Small helpers shared by forms and components.

// Escape text before putting it inside an HTML string (prevents script injection).
export const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Show or clear the red message under a form field. Expects <div id="{input.id}-error">.
export function setFieldError(input, message) {
  if (!input) return;
  const box = document.getElementById(`${input.id}-error`);
  if (message) {
    input.classList.add('is-invalid');
    input.setAttribute('aria-invalid', 'true');
    if (box) { box.textContent = message; box.hidden = false; input.setAttribute('aria-describedby', box.id); }
  } else {
    input.classList.remove('is-invalid');
    input.removeAttribute('aria-invalid');
    if (box) { box.textContent = ''; box.hidden = true; }
  }
}

// Disable a button and show a loading label while a request runs.
export function setLoading(button, loading, loadingText = 'Please wait...') {
  if (loading) {
    button.dataset.label = button.innerHTML;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.innerHTML = `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${esc(loadingText)}`;
  } else {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    if (button.dataset.label) button.innerHTML = button.dataset.label;
  }
}

// Eye icon buttons that show/hide a password. Markup: <button class="pw-toggle" data-target="password">
export function bindPasswordToggles(root = document) {
  root.querySelectorAll('.pw-toggle').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.target);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(show));
      button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      button.querySelector('i').className = show ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
    });
  });
}

// Show a banner (success / info / error) inside a container element.
export function showNotice(container, message, type = 'info') {
  container.innerHTML = '';
  const div = document.createElement('div');
  div.className = `notice notice-${type}`;
  div.setAttribute('role', type === 'error' ? 'alert' : 'status');
  div.textContent = message;
  container.appendChild(div);
}

// ---------- Phase 3 helpers ----------
export const formatFee = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

// Only allow images from our own site or https (blocks javascript: URLs in image fields).
export const safeImage = (url) =>
  (typeof url === 'string' && (url.startsWith('/images/') || url.startsWith('https://'))) ? url : '/images/doctor-placeholder.svg';

// A row of grey placeholder cards shown while data loads. Usage: container.innerHTML = skeletonCards(4)
export const skeletonCards = (count = 4) =>
  Array.from({ length: count }, () => '<div class="skeleton-card" aria-hidden="true"><div class="skeleton sk-img"></div><div class="sk-body"><div class="skeleton sk-line w60"></div><div class="skeleton sk-line w40"></div><div class="skeleton sk-line w80"></div></div></div>').join('');

// A friendly box for "nothing found" and "something broke" states. action = { href, label } (optional).
export const stateBox = (title, text, action) =>
  `<div class="state-box"><h2 class="h5">${esc(title)}</h2><p class="text-muted mb-3">${esc(text)}</p>${action ? `<a class="btn btn-brand" href="${esc(action.href)}">${esc(action.label)}</a>` : ''}</div>`;

// Rating as text: '4.8', or 'New' for doctors without reviews yet.
export const rating = (value) => (Number(value) > 0 ? Number(value).toFixed(1) : 'New');

// ---------- Phase 4 helpers ----------
const STATUS_LABELS = {
  pending: 'Awaiting confirmation', confirmed: 'Confirmed', rescheduled: 'Rescheduled (awaiting confirmation)',
  completed: 'Completed', cancelled: 'Cancelled', rejected: 'Declined by doctor', 'no-show': 'Missed',
};
export const statusBadge = (status) => `<span class="st st-${esc(String(status).replace(/[^a-z-]/g, ''))}">${esc(STATUS_LABELS[status] || status)}</span>`;

const PAY_LABELS = { pending: 'Payment pending', paid: 'Paid (demo)', failed: 'Payment failed', refunded: 'Refunded (demo)' };
export const paymentBadge = (status) => `<span class="st st-pay-${esc(String(status).replace(/[^a-z-]/g, ''))}">${esc(PAY_LABELS[status] || status)}</span>`;

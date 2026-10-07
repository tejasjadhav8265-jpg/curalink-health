import { requireRole } from '../core/guard.js';
import { mountLayout } from '../components/layout.js';
import { showToast } from '../core/toast.js';

// <body data-role="patient|doctor|admin"> decides who may open the page.
const role = document.body.dataset.role;
const user = await requireRole(role);

mountLayout({ user, active: 'dashboard' });
document.getElementById('welcome').textContent = `Welcome, ${user.firstName}`;
document.getElementById('who-email').textContent = user.email;
document.getElementById('who-role').textContent = user.role;

// Someone tried to open a page that belongs to another role and was sent back here.
if (new URLSearchParams(window.location.search).get('denied')) {
  showToast('That page is not available for your account type.', 'error');
}

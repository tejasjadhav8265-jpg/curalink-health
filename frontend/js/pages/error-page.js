import { getCurrentUser } from '../core/auth.js';
import { mountLayout } from '../components/layout.js';

// Shared by the 404, 403 and 500 pages. Works for guests and logged-in people.
mountLayout({ user: await getCurrentUser() });
const path = document.getElementById('path');
if (document.body.dataset.code === '404' && window.location.pathname !== '/pages/errors/404.html') {
  path.textContent = `Address: ${window.location.pathname}`; // textContent: never trusted as HTML
  path.hidden = false;
}
document.getElementById('back').addEventListener('click', () => {
  if (window.history.length > 1) window.history.back(); else window.location.href = '/';
});

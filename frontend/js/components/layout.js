import { renderNavbar } from './navbar.js';
import { renderFooter } from './footer.js';
import { logout } from '../core/auth.js';
import { api } from '../core/api.js';

// Fills <header id="site-header"> and <footer id="site-footer"> on a page.
// user: result of getCurrentUser() (or null). active: which nav link to highlight.
// Shows the unread number on the bell (hidden when 0).
export function setBell(count) {
  const badge = document.getElementById('bell-count');
  if (!badge) return;
  badge.textContent = count > 99 ? '99+' : String(count);
  badge.hidden = !count;
  const bell = document.getElementById('nav-bell');
  if (bell) bell.setAttribute('aria-label', count ? `Notifications, ${count} unread` : 'Notifications');
}

export function mountLayout({ user = null, active = '' } = {}) {
  const header = document.getElementById('site-header');
  const footer = document.getElementById('site-footer');
  if (header) {
    header.innerHTML = renderNavbar(user, active);
    header.addEventListener('click', (event) => {
      if (event.target.closest('[data-action="logout"]')) logout();
    });
  }
  if (footer) footer.innerHTML = renderFooter();
  if (user && (user.role === 'patient' || user.role === 'doctor')) { // fill the bell without making the page wait
    api.get('/notifications/unread-count').then((r) => setBell(r.data.unreadCount)).catch(() => {});
  }
}

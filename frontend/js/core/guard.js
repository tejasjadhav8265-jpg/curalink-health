import { getCurrentUser, dashboardPathFor } from './auth.js';
import { PATHS } from './config.js';

const stay = () => new Promise(() => {}); // never resolves: stops the page script while the browser redirects

// Put at the top of every protected page: const user = await requireRole('patient');
// - not logged in  -> login page (and come back here afterwards)
// - wrong role     -> that user's own dashboard
// The server enforces the same rules on every API call; this only avoids showing the wrong page.
export async function requireRole(...roles) {
  const user = await getCurrentUser();
  if (!user) {
    window.location.replace(`${PATHS.login}?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    return stay();
  }
  if (roles.length && !roles.includes(user.role)) {
    window.location.replace(`${dashboardPathFor(user.role)}?denied=1`);
    return stay();
  }
  return user;
}

// For login / register pages: someone already signed in does not need them.
export async function redirectIfLoggedIn() {
  const user = await getCurrentUser();
  if (user) {
    window.location.replace(dashboardPathFor(user.role));
    return stay();
  }
  return null;
}

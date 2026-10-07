import { api } from './api.js';
import { PATHS } from './config.js';

let cachedUser; // undefined = not asked yet, null = logged out

// Who is logged in? Returns { id, firstName, fullName, email, role } or null.
export async function getCurrentUser({ force = false } = {}) {
  if (cachedUser !== undefined && !force) return cachedUser;
  try {
    const response = await api.get('/auth/me');
    cachedUser = response.data.user;
  } catch (_) {
    cachedUser = null; // 401 (not logged in) or server unreachable
  }
  return cachedUser;
}

export const dashboardPathFor = (role) => (PATHS[role] && PATHS[role].dashboard) || PATHS.home;

export async function logout() {
  try { await api.post('/auth/logout'); } catch (_) { /* cookie may already be gone */ }
  cachedUser = null;
  window.location.href = `${PATHS.login}?loggedout=1`;
}

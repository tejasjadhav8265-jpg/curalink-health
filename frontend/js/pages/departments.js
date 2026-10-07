import { getCurrentUser } from '../core/auth.js';
import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { esc, stateBox } from '../core/ui.js';

mountLayout({ user: await getCurrentUser(), active: 'departments' });

const box = document.getElementById('dept-list');
box.innerHTML = '<p class="text-muted">Loading departments...</p>';
try {
  const { departments } = (await api.get('/departments')).data;
  box.innerHTML = departments.length
    ? departments.map((d) => `<a class="dept-card" href="${PATHS.departmentDetails}?slug=${encodeURIComponent(d.slug)}">
        <span class="dept-icon"><i class="fa-solid ${esc(d.icon || 'fa-stethoscope')}" aria-hidden="true"></i></span>
        <h3>${esc(d.name)}</h3><p>${esc(d.description || '')}</p>
        <span class="count">${esc(d.doctorCount)} ${d.doctorCount === 1 ? 'doctor' : 'doctors'}</span></a>`).join('')
    : stateBox('No departments yet', 'An administrator has not added any departments.');
} catch (error) {
  box.innerHTML = stateBox('Could not load departments', error.message);
}
box.setAttribute('aria-busy', 'false');

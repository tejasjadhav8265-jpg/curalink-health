import { getCurrentUser } from '../core/auth.js';
import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { renderDoctorCard } from '../components/doctor-card.js';
import { esc, skeletonCards, stateBox } from '../core/ui.js';

mountLayout({ user: await getCurrentUser(), active: 'departments' });

const slug = new URLSearchParams(window.location.search).get('slug');
const head = document.getElementById('dept-head');
const list = document.getElementById('dept-doctors');

if (!slug) {
  head.innerHTML = stateBox('No department selected', 'Pick a department from the list.', { href: PATHS.departments, label: 'View departments' });
  document.getElementById('crumb').textContent = 'Not found';
} else {
  list.innerHTML = skeletonCards(3);
  try {
    const [{ data: { department } }, { data: { doctors, pagination } }] = await Promise.all([
      api.get(`/departments/${encodeURIComponent(slug)}`),
      api.get(`/doctors?department=${encodeURIComponent(slug)}&limit=24`),
    ]);
    document.title = `${department.name} | CuraLink Health`;
    document.getElementById('crumb').textContent = department.name;
    head.innerHTML = `<div class="panel"><div class="d-flex gap-3 align-items-center">
      <span class="dept-icon mb-0"><i class="fa-solid ${esc(department.icon || 'fa-stethoscope')}" aria-hidden="true"></i></span>
      <div><h1 class="h2 mb-1">${esc(department.name)}</h1><p class="text-muted mb-0">${esc(department.description || '')}</p></div></div></div>`;
    document.getElementById('doc-heading').textContent = `${pagination.total} ${pagination.total === 1 ? 'doctor' : 'doctors'} in ${department.name}`;
    document.getElementById('see-all').href = `${PATHS.findDoctor}?department=${encodeURIComponent(slug)}`;
    list.innerHTML = doctors.length
      ? doctors.map((d) => renderDoctorCard(d)).join('')
      : stateBox('No doctors here yet', 'Try another department.', { href: PATHS.departments, label: 'View departments' });
  } catch (error) {
    document.getElementById('crumb').textContent = 'Not found';
    head.innerHTML = '';
    list.innerHTML = stateBox(error.status === 404 ? 'Department not found' : 'Could not load this department', error.message, { href: PATHS.departments, label: 'View departments' });
  }
}

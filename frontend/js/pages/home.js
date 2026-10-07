import { getCurrentUser } from '../core/auth.js';
import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { esc, safeImage, formatFee, rating, stateBox } from '../core/ui.js';

const user = await getCurrentUser();
mountLayout({ user, active: 'home' });

const form = document.getElementById('home-search');
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const params = new URLSearchParams();
  if (form.q.value.trim()) params.set('q', form.q.value.trim());
  if (form.location.value) params.set('location', form.location.value);
  window.location.href = `${PATHS.findDoctor}${params.toString() ? `?${params}` : ''}`;
});

// Departments, locations and doctors all come from the database.
const [facetsResult, deptResult, doctorResult] = await Promise.allSettled([
  api.get('/doctors/facets'),
  api.get('/departments'),
  api.get('/doctors?sort=rating&limit=4'),
]);

if (facetsResult.status === 'fulfilled') {
  facetsResult.value.data.locations.forEach((name) => form.location.add(new Option(name, name)));
}

const deptBox = document.getElementById('home-depts');
const chips = document.getElementById('home-chips');
if (deptResult.status === 'fulfilled') {
  const departments = deptResult.value.data.departments;
  const popular = [...departments].sort((a, b) => b.doctorCount - a.doctorCount).slice(0, 6);
  deptBox.innerHTML = popular.length
    ? popular.map((d) => `<a class="dept-card" href="${PATHS.departmentDetails}?slug=${encodeURIComponent(d.slug)}">
        <span class="dept-icon"><i class="fa-solid ${esc(d.icon || 'fa-stethoscope')}" aria-hidden="true"></i></span>
        <h3>${esc(d.name)}</h3><p>${esc(d.description || '')}</p>
        <span class="count">${esc(d.doctorCount)} ${d.doctorCount === 1 ? 'doctor' : 'doctors'}</span></a>`).join('')
    : stateBox('No departments yet', 'Run "npm run seed:doctors" to add starter data.');
  chips.innerHTML = popular.slice(0, 5).map((d) =>
    `<a class="chip" href="${PATHS.findDoctor}?department=${encodeURIComponent(d.slug)}">${esc(d.name)}</a>`).join('');
} else {
  deptBox.innerHTML = stateBox('Could not load departments', deptResult.reason.message);
}

const docBox = document.getElementById('home-doctors');
if (doctorResult.status === 'fulfilled') {
  const doctors = doctorResult.value.data.doctors;
  docBox.innerHTML = doctors.length
    ? doctors.map((d) => `<a class="feat-card" href="${PATHS.doctorDetails}?id=${encodeURIComponent(d._id)}">
        <img src="${esc(safeImage(d.profileImage))}" alt="Photo of ${esc(d.name)}" width="72" height="72" loading="lazy">
        <h3>${esc(d.name)}</h3><p>${esc(d.specialization)}</p>
        <p>${esc(d.experience)} years &middot; ${esc(d.location)}</p>
        <p><i class="fa-solid fa-star" style="color:#C98A0B" aria-hidden="true"></i> <strong>${esc(rating(d.ratingAvg))}</strong> &middot; ${esc(formatFee(d.consultationFee))}</p></a>`).join('')
    : stateBox('No doctors yet', 'Run "npm run seed:doctors" to add starter data.');
} else {
  docBox.innerHTML = stateBox('Could not load doctors', doctorResult.reason.message);
}

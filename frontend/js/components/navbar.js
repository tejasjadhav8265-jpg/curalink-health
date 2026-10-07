import { BRAND, PATHS } from '../core/config.js';
import { dashboardPathFor } from '../core/auth.js';
import { esc } from '../core/ui.js';

const link = (key, label, href, active) =>
  `<li class="nav-item"><a class="nav-link${active === key ? ' active' : ''}" href="${href}"${active === key ? ' aria-current="page"' : ''}>${label}</a></li>`;

const serviceLinks = [
  ['Emergency', PATHS.emergency], ['Ambulance', PATHS.ambulance], ['Health packages', PATHS.packages],
  ['Diagnostics', PATHS.diagnostics], ['Pharmacy', PATHS.pharmacy], ['Insurance and TPA', PATHS.insurance],
  ['Teleconsultation', PATHS.teleconsultation], ['Health articles', PATHS.articles],
  ['Which doctor do I need?', PATHS.specialtyFinder], ['FAQ', PATHS.faq],
];

function menuFor(user, active) {
  if (!user) {
    // Guests: the Appointments link sends them to log in, then brings them back.
    const toAppointments = `${PATHS.login}?next=${encodeURIComponent(PATHS.patient.appointments)}`;
    return [
      link('home', 'Home', PATHS.home, active),
      link('find-doctor', 'Find doctor', PATHS.findDoctor, active),
      link('departments', 'Departments', PATHS.departments, active),
      link('appointments', 'Appointments', toAppointments, active),
      `<li class="nav-item dropdown">
        <a class="nav-link dropdown-toggle${active === 'services' ? ' active' : ''}" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">Health services</a>
        <ul class="dropdown-menu">${serviceLinks.map(([l, h]) => `<li><a class="dropdown-item" href="${h}">${l}</a></li>`).join('')}</ul>
      </li>`,
      link('about', 'About', PATHS.about, active),
      link('contact', 'Contact', PATHS.contact, active),
    ].join('');
  }
  if (user.role === 'patient') {
    const p = PATHS.patient;
    return [
      link('dashboard', 'Dashboard', p.dashboard, active), link('find-doctor', 'Find doctor', PATHS.findDoctor, active),
      link('appointments', 'Appointments', p.appointments, active), link('records', 'Medical records', p.records, active),
      link('profile', 'Profile', p.profile, active),
    ].join('');
  }
  if (user.role === 'doctor') {
    const d = PATHS.doctor;
    return [
      link('dashboard', 'Dashboard', d.dashboard, active), link('appointments', 'Appointments', d.appointments, active),
      link('queue', "Today's queue", d.queue, active), link('patients', 'Patients', d.patients, active), link('availability', 'Availability', d.availability, active),
      link('prescriptions', 'Prescriptions', d.prescriptions, active),
    ].join('');
  }
  const a = PATHS.admin; // admin
  return [
    link('dashboard', 'Dashboard', a.dashboard, active), link('doctors', 'Doctors', a.doctors, active),
    link('patients', 'Patients', a.patients, active), link('departments', 'Departments', a.departments, active),
    link('appointments', 'Appointments', a.appointments, active), link('analytics', 'Analytics', a.analytics, active),
    link('inbox', 'Requests', a.inbox, active), link('audit-logs', 'Audit logs', a.auditLogs, active),
  ].join('');
}

const bell = (role) => `<a class="bell" id="nav-bell" href="${PATHS[role].notifications}" aria-label="Notifications">
    <i class="fa-regular fa-bell" aria-hidden="true"></i><span class="bell-count" id="bell-count" hidden></span></a>`;

const patientMenuItems = () => [
  ['Prescriptions', PATHS.patient.prescriptions], ['Payments', PATHS.patient.payments], ['Reviews', PATHS.patient.feedback], ['Insurance', PATHS.insurance], ['Health packages', PATHS.packages], ['Notifications', PATHS.patient.notifications],
].map(([l, h]) => `<li><a class="dropdown-item" href="${h}">${l}</a></li>`).join('');

function accountArea(user) {
  if (!user) {
    return `<a class="btn btn-ghost" href="${PATHS.login}">Log in</a>
      <a class="btn btn-brand" href="${PATHS.register}" target="_blank" rel="noopener">Register</a>`;
  }
  return `${user.role === 'patient' || user.role === 'doctor' ? bell(user.role) : ''}<div class="dropdown">
    <button class="btn btn-ghost dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
      <i class="fa-regular fa-circle-user me-1" aria-hidden="true"></i>${esc(user.firstName)}
    </button>
    <ul class="dropdown-menu dropdown-menu-end">
      <li class="dropdown-header">${esc(user.fullName)}<br><span class="text-muted small">${esc(user.role)}</span></li>
      <li><a class="dropdown-item" href="${dashboardPathFor(user.role)}">My dashboard</a></li>
      ${user.role === 'patient' ? patientMenuItems() : ''}
      ${user.role === 'doctor' ? `<li><a class="dropdown-item" href="${PATHS.doctor.notifications}">Notifications</a></li>` : ''}
      <li><hr class="dropdown-divider"></li>
      <li><button class="dropdown-item" type="button" data-action="logout">Log out</button></li>
    </ul>
  </div>`;
}

export function renderNavbar(user, active) {
  return `<nav class="navbar navbar-expand-lg site-nav" aria-label="Main navigation">
    <div class="container-xxl">
      <a class="brand" href="${PATHS.home}"><span class="brand-mark" aria-hidden="true"></span><span>${esc(BRAND.name)}</span></a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#main-nav"
        aria-controls="main-nav" aria-expanded="false" aria-label="Show or hide the menu"><span class="navbar-toggler-icon"></span></button>
      <div class="collapse navbar-collapse" id="main-nav">
        <ul class="navbar-nav me-auto mb-2 mb-lg-0">${menuFor(user, active)}</ul>
        <div class="nav-actions">${accountArea(user)}</div>
      </div>
    </div>
  </nav>`;
}

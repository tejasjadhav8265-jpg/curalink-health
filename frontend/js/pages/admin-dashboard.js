import { requireRole } from '../core/guard.js';
import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { esc, stateBox, statusBadge } from '../core/ui.js';
import { formatDate, to12h, formatDateTime } from '../core/dates.js';

const user = await requireRole('admin');
mountLayout({ user, active: 'dashboard' });
document.getElementById('page-title').textContent = `Welcome, ${user.firstName}`;
const root = document.getElementById('root');

const stat = (href, value, label, extra = '') => `<a class="stat" href="${href}"><strong>${esc(value)}</strong><span>${esc(label)}${extra}</span></a>`;

try {
  const { stats, recentAppointments, recentAudit } = (await api.get('/admin/dashboard')).data;
  root.innerHTML = `
    ${stats.inactiveDoctors ? `<div class="alert-strip"><span><i class="fa-solid fa-circle-info me-2" aria-hidden="true"></i>${esc(stats.inactiveDoctors)} ${stats.inactiveDoctors === 1 ? 'doctor is' : 'doctors are'} switched off and hidden from patients.</span><a class="btn btn-ghost btn-sm-brand" href="${PATHS.admin.doctors}?status=inactive">Review</a></div>` : ''}
    <div class="stat-grid">
      ${stat(PATHS.admin.appointments, stats.today, "Today's appointments")}
      ${stat(`${PATHS.admin.appointments}?status=pending`, stats.pending, 'Awaiting confirmation')}
      ${stat(PATHS.admin.patients, stats.patients, 'Active patients')}
      ${stat(PATHS.admin.doctors, stats.doctors, 'Active doctors')}
      ${stat(PATHS.admin.departments, stats.departments, 'Departments')}
      ${stat(PATHS.admin.analytics, `₹${Number(stats.revenue).toLocaleString('en-IN')}`, 'Revenue', '<em class="demo-tag">DEMO</em>')}
    </div>
    <div class="two-col">
      <section class="panel"><h2 class="h5">Recent bookings</h2>
        ${recentAppointments.length ? `<ul class="mini-list">${recentAppointments.map((a) => `<li><a href="${PATHS.admin.appointments}?q=${encodeURIComponent(a.appointmentId)}">${esc(a.patient)}</a> with ${esc(a.doctor)}<br><span class="when">${esc(formatDate(a.appointmentDate))} at ${esc(to12h(a.slotTime))} &middot; ${esc(a.appointmentId)}</span> ${statusBadge(a.status)}</li>`).join('')}</ul>` : '<p class="text-muted mb-0">No bookings yet.</p>'}
        <a class="btn btn-ghost btn-sm-brand mt-3" href="${PATHS.admin.appointments}">All appointments</a></section>
      <section class="panel"><h2 class="h5">Recent activity</h2>
        ${recentAudit.length ? `<ul class="mini-list">${recentAudit.map((l) => `<li><span class="log-action">${esc(l.action)}</span><br>${esc(l.description || '')}<br><span class="when">${esc(l.by)}${l.role ? ` (${esc(l.role)})` : ''} &middot; ${esc(formatDateTime(l.timestamp))}</span></li>`).join('')}</ul>` : '<p class="text-muted mb-0">Nothing recorded yet.</p>'}
        <a class="btn btn-ghost btn-sm-brand mt-3" href="${PATHS.admin.auditLogs}">All activity</a></section>
    </div>
    <div class="panel mt-4"><h2 class="h5">Quick actions</h2><div class="action-grid">
      <a class="action" href="/pages/admin/doctor-form.html"><i class="fa-solid fa-user-doctor" aria-hidden="true"></i>Add doctor</a>
      <a class="action" href="${PATHS.admin.departments}"><i class="fa-solid fa-hospital" aria-hidden="true"></i>Departments</a>
      <a class="action" href="${PATHS.admin.analytics}"><i class="fa-solid fa-chart-line" aria-hidden="true"></i>Analytics</a>
    </div></div>`;
} catch (error) { root.innerHTML = stateBox('Could not load the dashboard', error.message); }

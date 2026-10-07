import { PATHS } from '../core/config.js';
import { esc, statusBadge } from '../core/ui.js';
import { to12h, todayIST } from '../core/dates.js';
import { actionButtons } from './doctor-actions.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const patientLine = (p) => [p.gender ? p.gender[0].toUpperCase() + p.gender.slice(1) : '', p.age !== null && p.age !== undefined ? `${p.age} yrs` : ''].filter(Boolean).join(', ');

// One appointment as a card, with the doctor's action buttons.
export function doctorApptCard(a) {
  const [, m, d] = a.appointmentDate.split('-');
  const open = `${PATHS.doctor.consultation}?id=${encodeURIComponent(a._id)}`;
  return `<article class="appt-card">
    <div class="appt-date" aria-hidden="true"><span class="d">${esc(d)}</span><span class="m">${esc(MONTHS[Number(m) - 1])}</span></div>
    <div class="appt-main">
      <h2><a href="${open}">${esc(a.patient.name)}</a></h2>
      <p class="appt-meta">${esc(patientLine(a.patient))}${patientLine(a.patient) ? ' &middot; ' : ''}${esc(to12h(a.slotTime))} &middot; ${a.consultationType === 'video' ? 'Video' : 'In-person'}${a.tokenNumber ? ` &middot; Token ${esc(a.tokenNumber)}` : ''}</p>
      ${a.reason ? `<p class="small mb-1">Reason: ${esc(a.reason)}</p>` : ''}
      ${a.cancellationReason ? `<p class="small text-muted mb-1">Note: ${esc(a.cancellationReason)}</p>` : ''}
      <p class="mb-0">${statusBadge(a.status)}</p>
    </div>
    <div class="appt-actions"><a class="btn btn-ghost btn-sm-brand" href="${open}">Open</a>${a.consultationType === 'video' && a.status === 'confirmed' && a.appointmentDate === todayIST() ? `<a class="btn btn-brand btn-sm-brand" href="${PATHS.patient.room}?id=${encodeURIComponent(a._id)}">Video room</a>` : ''}${actionButtons(a)}</div>
  </article>`;
}

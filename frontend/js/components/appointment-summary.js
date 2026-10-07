import { esc, formatFee, paymentBadge } from '../core/ui.js';
import { formatDate, to12h } from '../core/dates.js';

// A tidy "label / value" list used on the confirmation and details pages.
export function summaryList(a) {
  const doc = a.doctor || {};
  const row = (label, value) => `<li><span>${esc(label)}</span><span>${value}</span></li>`;
  return `<ul class="fact-list">
    ${row('Appointment ID', esc(a.appointmentId))}
    ${row('Doctor', esc(doc.name || 'Doctor'))}
    ${row('Specialty', esc(doc.specialization || (a.department && a.department.name) || ''))}
    ${row('Date', esc(formatDate(a.appointmentDate)))}
    ${row('Time', esc(to12h(a.slotTime)))}
    ${row('Visit type', a.consultationType === 'video' ? 'Video consultation' : 'In-person visit')}
    ${a.consultationType === 'video' ? '' : row('Location', `${esc(doc.location || '')}${doc.branch ? `<br>${esc(doc.branch)}` : ''}`)}
    ${row('Fee', esc(formatFee(doc.consultationFee)))}
    ${row('Payment', paymentBadge(a.paymentStatus))}
    ${a.reason ? row('Reason', esc(a.reason)) : ''}
  </ul>`;
}

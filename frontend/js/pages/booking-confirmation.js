import { requireRole } from '../core/guard.js';
import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { summaryList } from '../components/appointment-summary.js';
import { esc, stateBox } from '../core/ui.js';
import { formatDate, to12h } from '../core/dates.js';

const user = await requireRole('patient');
mountLayout({ user, active: 'appointments' });

const id = new URLSearchParams(window.location.search).get('id');
const root = document.getElementById('confirm');
document.querySelector('.page-head').hidden = true;

if (!id) {
  root.innerHTML = stateBox('No booking found', 'Open your appointments to see your bookings.', { href: PATHS.patient.appointments, label: 'My appointments' });
} else {
  try {
    const a = (await api.get(`/appointments/${encodeURIComponent(id)}`)).data.appointment;
    const details = `${PATHS.patient.appointmentDetails}?id=${encodeURIComponent(a._id)}`;
    const needsPay = a.paymentStatus !== 'paid';
    root.innerHTML = `
    <section class="panel confirm-hero">
      <div class="confirm-icon" aria-hidden="true"><i class="fa-solid fa-check"></i></div>
      <h1 class="h3">Your appointment is booked</h1>
      <p class="text-muted mb-2">${esc((a.doctor || {}).name)} on ${esc(formatDate(a.appointmentDate))} at ${esc(to12h(a.slotTime))}</p>
      <p class="mb-1 text-muted">Your token number</p>
      <p class="token-big">${esc(a.tokenNumber || 'Pending')}</p>
      <p class="small text-muted mb-0">The doctor will confirm your visit. You will see the update in your appointments.</p>
    </section>
    <div class="details-grid">
      <section class="panel"><h2 class="h5">Booking details</h2>${summaryList(a)}</section>
      <section class="panel">
        <h2 class="h5">What next?</h2>
        <ul class="small text-muted ps-3">
          <li>Arrive 10 minutes early and bring any old reports.</li>
          <li>You can reschedule or cancel from your appointments.</li>
          <li>Payment is optional now. You can also pay at the clinic.</li>
        </ul>
        <div class="d-grid gap-2">
          ${needsPay ? `<a class="btn btn-brand" href="${PATHS.patient.payment}?id=${encodeURIComponent(a._id)}">Pay now (demo)</a>` : ''}
          <a class="btn btn-ghost" href="${details}">View appointment details</a>
          <a class="btn btn-ghost" href="${PATHS.patient.appointments}">My appointments</a>
        </div>
      </section>
    </div>`;
    document.title = 'Booking confirmed | CuraLink Health';
  } catch (error) {
    root.innerHTML = stateBox('Could not load this booking', error.message, { href: PATHS.patient.appointments, label: 'My appointments' });
  }
}

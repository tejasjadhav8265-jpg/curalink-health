import { requireRole } from '../core/guard.js';
import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { esc, formatFee, setLoading, stateBox } from '../core/ui.js';
import { showToast } from '../core/toast.js';
import { formatDate, to12h } from '../core/dates.js';

const user = await requireRole('patient');
mountLayout({ user, active: 'appointments' });

const id = new URLSearchParams(window.location.search).get('id');
const root = document.getElementById('pay');
const back = (a) => `${PATHS.patient.appointmentDetails}?id=${encodeURIComponent(a._id)}`;

if (!id) {
  root.innerHTML = stateBox('No appointment selected', 'Open an appointment to pay for it.', { href: PATHS.patient.appointments, label: 'My appointments' });
} else {
  try {
    const a = (await api.get(`/appointments/${encodeURIComponent(id)}`)).data.appointment;
    const doc = a.doctor || {};
    if (a.paymentStatus === 'paid') {
      root.innerHTML = stateBox('Already paid', 'This appointment has already been paid for (demo).', { href: back(a), label: 'View appointment' });
    } else if (!['pending', 'confirmed', 'rescheduled'].includes(a.status)) {
      root.innerHTML = stateBox('Payment not available', 'This appointment is no longer active.', { href: PATHS.patient.appointments, label: 'My appointments' });
    } else {
      root.innerHTML = `
      <div class="demo-banner" role="note"><i class="fa-solid fa-flask me-2" aria-hidden="true"></i>DEMO PAYMENT. No real money is taken and you do not need to enter any card details.</div>
      <div class="details-grid">
        <section class="panel">
          <h2 class="h5">Consultation fee</h2>
          <p class="pay-amount">${esc(formatFee(doc.consultationFee))}</p>
          <p class="text-muted mb-0">${esc(doc.name || 'Doctor')} &middot; ${esc(formatDate(a.appointmentDate))} at ${esc(to12h(a.slotTime))}</p>
        </section>
        <section class="panel">
          <h2 class="h5">Choose</h2>
          <div class="notice notice-error mb-3" id="pay-error" role="alert" hidden></div>
          <div class="d-grid gap-2">
            <button class="btn btn-brand" id="pay-ok" type="button">Pay ${esc(formatFee(doc.consultationFee))} (demo)</button>
            <button class="btn btn-ghost" id="pay-fail" type="button">Simulate a failed payment</button>
            <a class="btn btn-ghost" href="${back(a)}">Pay at the clinic instead</a>
          </div>
        </section>
      </div>`;

      const err = document.getElementById('pay-error');
      async function pay(outcome, button, label) {
        err.hidden = true;
        setLoading(button, true, label);
        try {
          const res = await api.post('/payments/demo', { appointmentId: a._id, outcome });
          if (res.data.paymentStatus === 'paid') {
            showToast(`Demo payment successful. Ref ${res.data.payment.transactionRef}`, 'success', 6000);
            window.location.href = back(a);
          } else {
            setLoading(button, false);
            err.textContent = 'The demo payment failed. You can try again or pay at the clinic.';
            err.hidden = false;
          }
        } catch (error) {
          setLoading(button, false);
          err.textContent = error.message;
          err.hidden = false;
        }
      }
      document.getElementById('pay-ok').addEventListener('click', (e) => pay('paid', e.currentTarget, 'Processing...'));
      document.getElementById('pay-fail').addEventListener('click', (e) => pay('failed', e.currentTarget, 'Processing...'));
    }
  } catch (error) {
    root.innerHTML = stateBox('Could not load this payment page', error.message, { href: PATHS.patient.appointments, label: 'My appointments' });
  }
}

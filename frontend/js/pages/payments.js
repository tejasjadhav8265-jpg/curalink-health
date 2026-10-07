import { requireRole } from '../core/guard.js';
import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { esc, formatFee, paymentBadge, stateBox } from '../core/ui.js';
import { formatDay, formatDate, to12h } from '../core/dates.js';

const user = await requireRole('patient');
mountLayout({ user, active: 'payments' });
const root = document.getElementById('pays');

try {
  const { payments } = (await api.get('/payments')).data;
  if (!payments.length) {
    root.innerHTML = stateBox('No payments yet', 'Payments you make for appointments will be listed here.', { href: PATHS.patient.appointments, label: 'My appointments' });
  } else {
    const sum = (status) => payments.filter((p) => p.status === status).reduce((t, p) => t + p.amount, 0);
    root.innerHTML = `
    <div class="demo-banner" role="note"><i class="fa-solid fa-flask me-2" aria-hidden="true"></i>These are DEMO payments. No real money was taken.</div>
    <section class="panel">
      <div class="pay-totals"><div><strong>${esc(formatFee(sum('paid')))}</strong><span>Paid (demo)</span></div><div><strong>${esc(formatFee(sum('refunded')))}</strong><span>Refunded (demo)</span></div><div><strong>${esc(payments.length)}</strong><span>Transactions</span></div></div>
      <div class="table-responsive"><table class="pay-table"><caption class="visually-hidden">Payment history</caption>
        <thead><tr><th scope="col">Date</th><th scope="col">Reference</th><th scope="col">For</th><th scope="col">Amount</th><th scope="col">Status</th></tr></thead>
        <tbody>${payments.map((p) => {
          const a = p.appointment;
          const forText = a ? `${esc((a.doctor || {}).name || 'Doctor')}<br><span class="when">${esc(formatDate(a.appointmentDate))}, ${esc(to12h(a.slotTime))}</span><br><a class="small" href="${PATHS.patient.appointmentDetails}?id=${encodeURIComponent(a._id)}">View appointment</a>` : 'Appointment';
          return `<tr><td>${esc(formatDay(p.paidAt || p.createdAt))}</td><td>${esc(p.transactionRef || p.paymentId)}<br><span class="when">${esc(p.paymentId)}</span></td><td>${forText}</td><td>${esc(formatFee(p.amount))}</td><td>${paymentBadge(p.status)}</td></tr>`;
        }).join('')}</tbody></table></div>
    </section>`;
  }
} catch (error) { root.innerHTML = stateBox('Could not load your payments', error.message); }

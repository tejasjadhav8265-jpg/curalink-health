const crypto = require('crypto');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const Payment = require('../models/Payment');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { SLOT_HOLDING_STATUSES } = require('../utils/constants');
const { audit } = require('../services/auditService');
const { notify } = require('../services/notificationService');

// POST /api/payments/demo  - DEMO ONLY: records a payment but no real money moves and no card is needed.
// outcome 'failed' lets you see how a failed payment looks.
const payDemo = asyncHandler(async (req, res) => {
  const { appointmentId } = req.body;
  const status = req.body.outcome === 'failed' ? 'failed' : 'paid';

  const appt = await Appointment.findOne({ _id: appointmentId, patient: req.user._id });
  if (!appt) throw ApiError.notFound('Appointment not found.');
  if (!SLOT_HOLDING_STATUSES.includes(appt.status)) throw ApiError.badRequest('This appointment is no longer active.');
  if (appt.paymentStatus === 'paid') throw ApiError.conflict('This appointment is already paid.');

  const doctor = await Doctor.findById(appt.doctor).select('name consultationFee');
  if (!doctor) throw ApiError.notFound('Doctor not found.');

  const payment = await Payment.create({
    patient: req.user._id, type: 'appointment', appointment: appt._id, amount: doctor.consultationFee,
    status, method: 'DEMO', transactionRef: `DEMO-${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
    paidAt: status === 'paid' ? new Date() : undefined,
  });
  appt.paymentStatus = status;
  await appt.save();

  if (status === 'paid') {
    await notify(req.user._id, {
      type: 'payment_confirmation', title: 'Payment received (demo)',
      message: `Demo payment of ₹${doctor.consultationFee} for your visit with ${doctor.name}. Reference ${payment.transactionRef}.`,
      link: `/pages/patient/appointment-details.html?id=${appt._id}`,
    });
  }
  await audit({ req, user: req.user._id, action: status === 'paid' ? 'PAYMENT_DEMO_PAID' : 'PAYMENT_DEMO_FAILED', entity: 'Payment', entityId: payment._id, description: `Demo payment ${status} for appointment ${appt.appointmentId}` });

  res.json({
    success: true,
    message: status === 'paid' ? 'Demo payment successful.' : 'Demo payment failed.',
    data: { paymentStatus: status, payment: { paymentId: payment.paymentId, amount: payment.amount, status, method: payment.method, transactionRef: payment.transactionRef, paidAt: payment.paidAt } },
  });
});

// GET /api/payments - the patient's own payment history
const list = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ patient: req.user._id }).sort({ createdAt: -1 }).limit(100)
    .populate({ path: 'appointment', select: 'appointmentId appointmentDate slotTime doctor', populate: { path: 'doctor', select: 'name specialization' } })
    .select('-__v').lean();
  res.json({ success: true, data: { payments } });
});

module.exports = { payDemo, list };

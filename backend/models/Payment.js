const mongoose = require('mongoose');
const crypto = require('crypto');
const { PAYMENT_STATUSES } = require('../utils/constants');

// DEMO payments only: no real money moves. `method` is always 'DEMO' in this project.
const paymentSchema = new mongoose.Schema(
  {
    paymentId: { type: String, unique: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['appointment', 'package'], default: 'appointment' },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', index: true },
    packageBooking: { type: mongoose.Schema.Types.ObjectId, ref: 'PackageBooking' },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: PAYMENT_STATUSES, default: 'pending' },
    method: { type: String, default: 'DEMO' },
    transactionRef: { type: String },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

paymentSchema.pre('validate', function setId(next) {
  if (!this.paymentId) this.paymentId = `PAY-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  next();
});

module.exports = mongoose.model('Payment', paymentSchema);

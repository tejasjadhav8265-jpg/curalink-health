const mongoose = require('mongoose');
const crypto = require('crypto');
const {
  APPOINTMENT_STATUSES, SLOT_HOLDING_STATUSES, CONSULTATION_TYPES, PAYMENT_STATUSES, DATE_REGEX, TIME_REGEX,
} = require('../utils/constants');

const rescheduleSchema = new mongoose.Schema(
  {
    oldDate: String, oldTime: String, newDate: String, newTime: String,
    reason: String, changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const appointmentSchema = new mongoose.Schema(
  {
    appointmentId: { type: String, unique: true, index: true }, // human-friendly, e.g. APT-20261006-4F9A2C
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    // Date and time kept as plain strings so there is no timezone drift: '2026-10-12' and '10:30'.
    appointmentDate: { type: String, required: [true, 'Please select an appointment date.'], match: [DATE_REGEX, 'Invalid date.'] },
    slotTime: { type: String, required: [true, 'Please select an appointment time.'], match: [TIME_REGEX, 'Invalid time.'] },
    consultationType: { type: String, enum: CONSULTATION_TYPES, default: 'in-person' },
    reason: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: APPOINTMENT_STATUSES, default: 'pending', index: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'pending' },

    // Queue/token system
    tokenSeq: { type: Number },         // 24
    tokenNumber: { type: String },      // 'A-024'

    cancellationReason: { type: String, trim: true, maxlength: 300 },
    cancelledAt: { type: Date },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rescheduleHistory: [rescheduleSchema],

    // DOUBLE-BOOKING GUARD: true only while the appointment occupies its slot.
    // Kept in sync with `status` by the pre-save hook below.
    slotLocked: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/*
 * Database-level double-booking prevention.
 * Only ONE document with slotLocked=true may exist per (doctor, date, time).
 * Cancelling/rejecting/completing releases the lock, so the slot is free again.
 * Because MongoDB enforces this atomically, two simultaneous requests cannot both succeed.
 * IMPORTANT: change status via doc.save() (not updateOne) so the hook can update slotLocked.
 */
appointmentSchema.index(
  { doctor: 1, appointmentDate: 1, slotTime: 1 },
  { unique: true, partialFilterExpression: { slotLocked: true }, name: 'no_double_booking' }
);
appointmentSchema.index({ doctor: 1, appointmentDate: 1, tokenSeq: 1 });
appointmentSchema.index({ patient: 1, appointmentDate: -1 });

appointmentSchema.pre('validate', function setDefaults(next) {
  if (!this.appointmentId) {
    const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    this.appointmentId = `APT-${d}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  }
  this.slotLocked = SLOT_HOLDING_STATUSES.includes(this.status);
  next();
});

module.exports = mongoose.model('Appointment', appointmentSchema);

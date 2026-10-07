const Appointment = require('../models/Appointment');
const DoctorAvailability = require('../models/DoctorAvailability');
const { SLOT_HOLDING_STATUSES } = require('../utils/constants');
const { todayIST } = require('../utils/dates');

/*
 * Live queue for an appointment, only on the day of the visit.
 *  patientsAhead = active appointments for the same doctor today with an earlier time slot
 *  lastCompleted = token of the latest finished consultation today (the doctor marks visits completed in Phase 6)
 *  estimatedWaitMinutes = patientsAhead x the doctor's slot length
 */
async function queueFor(appt) {
  const today = todayIST();
  if (appt.appointmentDate !== today || !SLOT_HOLDING_STATUSES.includes(appt.status)) return { live: false };

  const [patientsAhead, lastDone, avail] = await Promise.all([
    Appointment.countDocuments({ doctor: appt.doctor, appointmentDate: today, slotTime: { $lt: appt.slotTime }, status: { $in: SLOT_HOLDING_STATUSES } }),
    Appointment.findOne({ doctor: appt.doctor, appointmentDate: today, status: 'completed' }).sort({ slotTime: -1 }).select('tokenNumber').lean(),
    DoctorAvailability.findOne({ doctor: appt.doctor }).select('slotDuration').lean(),
  ]);
  const slot = (avail && avail.slotDuration) || 30;
  return {
    live: true,
    tokenNumber: appt.tokenNumber || null,
    lastCompleted: lastDone ? lastDone.tokenNumber : null,
    patientsAhead,
    estimatedWaitMinutes: patientsAhead * slot,
  };
}

module.exports = { queueFor };

const Doctor = require('../models/Doctor');
const DoctorAvailability = require('../models/DoctorAvailability');
const Appointment = require('../models/Appointment');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { SLOT_HOLDING_STATUSES, WEEKDAYS } = require('../utils/constants');
const { todayIST, addDays } = require('../utils/dates');
const { slotsOnDate } = require('../services/slotRules');
const { audit } = require('../services/auditService');

async function myDoctor(req) {
  const doctor = await Doctor.findOne({ user: req.user._id }).select('_id name specialization');
  if (!doctor) throw ApiError.notFound('No doctor profile is linked to this account.');
  return doctor;
}

const emptyWeek = () => Object.fromEntries(WEEKDAYS.map((d) => [d, []]));

function shape(doctor, avail) {
  return {
    doctor: { name: doctor.name, specialization: doctor.specialization },
    slotDuration: avail ? avail.slotDuration : 30,
    weekly: avail ? Object.fromEntries(WEEKDAYS.map((d) => [d, (avail.weekly[d] || []).map(({ start, end }) => ({ start, end }))])) : emptyWeek(),
    blockedDates: avail ? [...(avail.blockedDates || [])].sort() : [],
  };
}

// Upcoming active appointments that no longer fit the schedule (they are kept, not cancelled).
async function countOutsideSchedule(doctorId, avail) {
  const upcoming = await Appointment.find({
    doctor: doctorId, slotLocked: true, appointmentDate: { $gte: todayIST() },
  }).select('appointmentDate slotTime').lean();
  return upcoming.filter((a) => !slotsOnDate(avail, a.appointmentDate).includes(a.slotTime) || (avail.blockedDates || []).includes(a.appointmentDate)).length;
}

// GET /api/availability   (doctor)
const get = asyncHandler(async (req, res) => {
  const doctor = await myDoctor(req);
  const avail = await DoctorAvailability.findOne({ doctor: doctor._id }).lean();
  res.json({ success: true, data: shape(doctor, avail) });
});

// PUT /api/availability   (doctor) { slotDuration, weekly }
const save = asyncHandler(async (req, res) => {
  const doctor = await myDoctor(req);
  const { slotDuration, weekly } = req.body; // already validated and cleaned by the validator
  const avail = await DoctorAvailability.findOneAndUpdate(
    { doctor: doctor._id }, { $set: { slotDuration, weekly } }, { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  const outside = await countOutsideSchedule(doctor._id, avail);
  await audit({ req, user: req.user._id, action: 'AVAILABILITY_UPDATED', entity: 'DoctorAvailability', entityId: avail._id, description: `${doctor.name} updated weekly timings (${slotDuration}-minute slots)` });
  res.json({
    success: true, message: 'Your timings were saved.',
    data: { ...shape(doctor, avail), warning: outside ? `${outside} upcoming ${outside === 1 ? 'appointment is' : 'appointments are'} outside your new timings. They were kept.` : '' },
  });
});

// POST /api/availability/block-date   (doctor) { date }
const blockDate = asyncHandler(async (req, res) => {
  const doctor = await myDoctor(req);
  const { date } = req.body;
  const today = todayIST();
  if (date < today) throw ApiError.badRequest('You cannot block a date in the past.');
  if (date > addDays(today, 365)) throw ApiError.badRequest('You can block dates up to one year ahead.');

  const avail = await DoctorAvailability.findOneAndUpdate(
    { doctor: doctor._id }, { $addToSet: { blockedDates: date } }, { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  const booked = await Appointment.countDocuments({ doctor: doctor._id, appointmentDate: date, slotLocked: true });
  await audit({ req, user: req.user._id, action: 'DATE_BLOCKED', entity: 'DoctorAvailability', entityId: avail._id, description: `${doctor.name} blocked ${date}` });
  res.json({
    success: true, message: `${date} is now blocked.`,
    data: { ...shape(doctor, avail), warning: booked ? `${booked} ${booked === 1 ? 'patient is' : 'patients are'} already booked on this date. Those appointments were kept.` : '' },
  });
});

// DELETE /api/availability/block-date/:date   (doctor)
const unblockDate = asyncHandler(async (req, res) => {
  const doctor = await myDoctor(req);
  const avail = await DoctorAvailability.findOneAndUpdate({ doctor: doctor._id }, { $pull: { blockedDates: req.params.date } }, { new: true }).lean();
  res.json({ success: true, message: `${req.params.date} is open again.`, data: { ...shape(doctor, avail), warning: '' } });
});

module.exports = { get, save, blockDate, unblockDate };

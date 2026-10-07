const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const DoctorAvailability = require('../models/DoctorAvailability');
const Payment = require('../models/Payment');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { SLOT_HOLDING_STATUSES, BOOKING_WINDOW_DAYS, MAX_RESCHEDULES, SLOT_TAKEN_MESSAGE } = require('../utils/constants');
const { todayIST, nowTimeIST } = require('../utils/dates');
const { clampInt } = require('../utils/text');
const { checkBookable } = require('../services/slotRules');
const { nextToken } = require('../services/tokenService');
const { queueFor } = require('../services/queueService');
const { audit } = require('../services/auditService');
const { notify } = require('../services/notificationService');

const DOCTOR_FIELDS = 'name specialization qualification location branch profileImage consultationFee consultationTypes user';
const PATIENT_FIELDS = 'firstName lastName phone email';

// Is this error MongoDB saying "that doctor + date + time is already taken"?
const isSlotConflict = (err) =>
  err && err.code === 11000 && ((err.keyPattern && err.keyPattern.slotTime) || /no_double_booking/.test(err.message || ''));

function withRelations(query, role) {
  query.populate('doctor', DOCTOR_FIELDS).populate('department', 'name');
  if (role !== 'patient') query.populate('patient', PATIENT_FIELDS);
  return query;
}

// Which appointments may this user see? Patients: their own. Doctors: their patients'. Admins: all.
async function scopeFor(user) {
  if (user.role === 'patient') return { patient: user._id };
  if (user.role === 'doctor') {
    const doctor = await Doctor.findOne({ user: user._id }).select('_id');
    if (!doctor) throw ApiError.forbidden('No doctor profile is linked to this account.');
    return { doctor: doctor._id };
  }
  return {};
}

// A patient's own appointment, or 404 (we never reveal that someone else's appointment exists).
async function ownedByPatient(req) {
  const appt = await Appointment.findOne({ _id: req.params.id, patient: req.user._id });
  if (!appt) throw ApiError.notFound('Appointment not found.');
  return appt;
}

const isUpcoming = (appt, today, nowHM) =>
  appt.appointmentDate > today || (appt.appointmentDate === today && appt.slotTime > nowHM);

// Same checks for booking and rescheduling: doctor active, slot real and in the future.
async function loadDoctorAndCheckSlot(doctorId, date, time) {
  const doctor = await Doctor.findOne({ _id: doctorId, status: 'active' });
  if (!doctor) throw ApiError.notFound('This doctor is not available for booking.');
  const avail = await DoctorAvailability.findOne({ doctor: doctor._id }).lean();
  const problem = checkBookable({ avail, date, time, today: todayIST(), nowHM: nowTimeIST(), windowDays: BOOKING_WINDOW_DAYS });
  if (problem) throw ApiError.badRequest(problem);
  return doctor;
}

// POST /api/appointments   (patient)
const create = asyncHandler(async (req, res) => {
  const { doctorId, date, time, reason } = req.body;
  const consultationType = req.body.consultationType || 'in-person';

  const doctor = await loadDoctorAndCheckSlot(doctorId, date, time);
  if (!doctor.consultationTypes.includes(consultationType)) {
    throw ApiError.badRequest(`${doctor.name} does not offer ${consultationType === 'video' ? 'video' : 'in-person'} visits.`);
  }

  // Friendly checks first. The database unique index below is what truly guarantees no double booking.
  if (await Appointment.exists({ doctor: doctor._id, appointmentDate: date, slotTime: time, slotLocked: true })) {
    throw ApiError.conflict(SLOT_TAKEN_MESSAGE);
  }
  if (await Appointment.exists({ patient: req.user._id, appointmentDate: date, slotTime: time, slotLocked: true })) {
    throw ApiError.conflict('You already have an appointment at this time with another doctor.');
  }

  let appt;
  try {
    appt = await Appointment.create({
      patient: req.user._id, doctor: doctor._id, department: doctor.department,
      appointmentDate: date, slotTime: time, consultationType, reason: reason || undefined,
    });
  } catch (err) {
    if (isSlotConflict(err)) throw ApiError.conflict(SLOT_TAKEN_MESSAGE); // someone booked it a split second before us
    throw err;
  }

  const token = await nextToken(doctor._id, date);
  await Appointment.updateOne({ _id: appt._id }, { $set: token });

  await notify(req.user._id, {
    type: 'appointment_confirmation', title: 'Appointment booked',
    message: `Your appointment with ${doctor.name} on ${date} at ${time} is booked and waiting for the doctor's confirmation. Token ${token.tokenNumber}.`,
    link: `/pages/patient/appointment-details.html?id=${appt._id}`,
  });
  if (doctor.user) {
    await notify(doctor.user, {
      type: 'general', title: 'New appointment request',
      message: `${req.user.firstName} ${req.user.lastName} booked ${date} at ${time}.`, link: '/pages/doctor/appointments.html',
    });
  }
  await audit({ req, user: req.user._id, action: 'APPOINTMENT_CREATED', entity: 'Appointment', entityId: appt._id, description: `Booked ${doctor.name} on ${date} ${time}` });

  const saved = await withRelations(Appointment.findById(appt._id), 'patient').select('-__v').lean();
  res.status(201).json({ success: true, message: 'Appointment booked.', data: { appointment: saved } });
});

// view -> MongoDB filter. "today" is India time.
function viewFilter(view, today) {
  if (view === 'upcoming') return { status: { $in: SLOT_HOLDING_STATUSES }, appointmentDate: { $gte: today } };
  if (view === 'cancelled') return { status: { $in: ['cancelled', 'rejected'] } };
  if (view === 'past') {
    return { $or: [
      { appointmentDate: { $lt: today }, status: { $nin: ['cancelled', 'rejected'] } },
      { status: { $in: ['completed', 'no-show'] } },
    ] };
  }
  return {};
}

// GET /api/appointments?view=upcoming|past|cancelled&page=1&limit=10
const list = asyncHandler(async (req, res) => {
  const scope = await scopeFor(req.user);
  const today = todayIST();
  const view = ['upcoming', 'past', 'cancelled'].includes(req.query.view) ? req.query.view : 'all';
  const page = clampInt(req.query.page, 1, 10000, 1);
  const limit = clampInt(req.query.limit, 1, 50, 10);
  const sort = view === 'upcoming' ? { appointmentDate: 1, slotTime: 1 } : { appointmentDate: -1, slotTime: -1 };
  const filter = { ...scope, ...viewFilter(view, today) };

  const [total, items, upcoming, past, cancelled] = await Promise.all([
    Appointment.countDocuments(filter),
    withRelations(Appointment.find(filter).sort(sort).skip((page - 1) * limit).limit(limit), req.user.role).select('-__v').lean(),
    Appointment.countDocuments({ ...scope, ...viewFilter('upcoming', today) }),
    Appointment.countDocuments({ ...scope, ...viewFilter('past', today) }),
    Appointment.countDocuments({ ...scope, ...viewFilter('cancelled', today) }),
  ]);

  res.json({
    success: true,
    data: {
      appointments: items,
      counts: { upcoming, past, cancelled },
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    },
  });
});

// GET /api/appointments/:id
const getOne = asyncHandler(async (req, res) => {
  const scope = await scopeFor(req.user);
  const appt = await withRelations(Appointment.findOne({ _id: req.params.id, ...scope }), req.user.role).select('-__v').lean();
  if (!appt) throw ApiError.notFound('Appointment not found.');
  const queue = await queueFor({ ...appt, doctor: appt.doctor._id });
  res.json({ success: true, data: { appointment: appt, queue } });
});

// PUT /api/appointments/:id/reschedule   (patient). The SAME record moves to the new slot, so the old
// slot is freed automatically, and if the new slot is taken the old booking stays exactly as it was.
const reschedule = asyncHandler(async (req, res) => {
  const appt = await ownedByPatient(req);
  const { date, time, reason } = req.body;
  const today = todayIST();

  if (!SLOT_HOLDING_STATUSES.includes(appt.status)) throw ApiError.badRequest('Only upcoming appointments can be rescheduled.');
  if (!isUpcoming(appt, today, nowTimeIST())) throw ApiError.badRequest('This appointment has already passed.');
  if (appt.rescheduleHistory.length >= MAX_RESCHEDULES) {
    throw ApiError.badRequest(`An appointment can be rescheduled up to ${MAX_RESCHEDULES} times. Please cancel it and book again.`);
  }
  if (date === appt.appointmentDate && time === appt.slotTime) throw ApiError.badRequest('Please choose a different date or time.');

  const doctor = await loadDoctorAndCheckSlot(appt.doctor, date, time);
  if (await Appointment.exists({ doctor: doctor._id, appointmentDate: date, slotTime: time, slotLocked: true })) {
    throw ApiError.conflict(SLOT_TAKEN_MESSAGE);
  }
  if (await Appointment.exists({ _id: { $ne: appt._id }, patient: req.user._id, appointmentDate: date, slotTime: time, slotLocked: true })) {
    throw ApiError.conflict('You already have an appointment at this time with another doctor.');
  }

  const old = { date: appt.appointmentDate, time: appt.slotTime };
  appt.rescheduleHistory.push({ oldDate: old.date, oldTime: old.time, newDate: date, newTime: time, reason: reason || undefined });
  appt.appointmentDate = date;
  appt.slotTime = time;
  appt.status = 'rescheduled'; // waits for the doctor to confirm the new time
  try {
    await appt.save();
  } catch (err) {
    if (isSlotConflict(err)) throw ApiError.conflict(SLOT_TAKEN_MESSAGE);
    throw err;
  }

  if (date !== old.date) { // a new day means a new place in that day's queue
    const token = await nextToken(doctor._id, date);
    await Appointment.updateOne({ _id: appt._id }, { $set: token });
  }

  await notify(req.user._id, {
    type: 'appointment_rescheduled', title: 'Appointment rescheduled',
    message: `Your appointment with ${doctor.name} moved from ${old.date} ${old.time} to ${date} ${time}.`,
    link: `/pages/patient/appointment-details.html?id=${appt._id}`,
  });
  if (doctor.user) {
    await notify(doctor.user, { type: 'general', title: 'Appointment rescheduled', message: `${req.user.firstName} ${req.user.lastName} moved to ${date} at ${time}.`, link: '/pages/doctor/appointments.html' });
  }
  await audit({ req, user: req.user._id, action: 'APPOINTMENT_RESCHEDULED', entity: 'Appointment', entityId: appt._id, description: `Moved ${old.date} ${old.time} to ${date} ${time}` });

  const saved = await withRelations(Appointment.findById(appt._id), 'patient').select('-__v').lean();
  res.json({ success: true, message: 'Appointment rescheduled.', data: { appointment: saved } });
});

// PUT /api/appointments/:id/cancel   (patient)
const cancel = asyncHandler(async (req, res) => {
  const appt = await ownedByPatient(req);
  if (!SLOT_HOLDING_STATUSES.includes(appt.status)) throw ApiError.badRequest('This appointment can no longer be cancelled.');
  if (appt.appointmentDate < todayIST()) throw ApiError.badRequest('Past appointments cannot be cancelled.');

  appt.status = 'cancelled'; // save() runs the hook that releases the slot for other patients
  appt.cancelledAt = new Date();
  appt.cancelledBy = req.user._id;
  appt.cancellationReason = req.body.reason;

  let refunded = false;
  if (appt.paymentStatus === 'paid') { // demo refund
    await Payment.updateMany({ appointment: appt._id, status: 'paid' }, { $set: { status: 'refunded' } });
    appt.paymentStatus = 'refunded';
    refunded = true;
  }
  await appt.save();

  const doctor = await Doctor.findById(appt.doctor).select('name user');
  await notify(req.user._id, {
    type: 'appointment_cancellation', title: 'Appointment cancelled',
    message: `Your appointment with ${doctor ? doctor.name : 'the doctor'} on ${appt.appointmentDate} at ${appt.slotTime} was cancelled.${refunded ? ' Your demo payment is marked as refunded.' : ''}`,
    link: `/pages/patient/appointment-details.html?id=${appt._id}`,
  });
  if (doctor && doctor.user) {
    await notify(doctor.user, { type: 'general', title: 'Appointment cancelled', message: `${req.user.firstName} ${req.user.lastName} cancelled ${appt.appointmentDate} at ${appt.slotTime}.`, link: '/pages/doctor/appointments.html' });
  }
  await audit({ req, user: req.user._id, action: 'APPOINTMENT_CANCELLED', entity: 'Appointment', entityId: appt._id, description: `Cancelled ${appt.appointmentDate} ${appt.slotTime}: ${appt.cancellationReason}` });

  const saved = await withRelations(Appointment.findById(appt._id), 'patient').select('-__v').lean();
  res.json({ success: true, message: 'Appointment cancelled.', data: { appointment: saved } });
});

module.exports = { create, list, getOne, reschedule, cancel };

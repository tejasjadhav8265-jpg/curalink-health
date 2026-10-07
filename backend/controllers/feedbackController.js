const Feedback = require('../models/Feedback');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { notify } = require('../services/notificationService');
const { audit } = require('../services/auditService');

// Keeps the doctor's average in step. sign = +1 adds a rating, -1 removes one (used when an admin hides a review).
// It adjusts the existing average instead of recounting, so the demo doctors' starting ratings are kept.
async function applyRating(doctorId, rating, sign) {
  const doctor = await Doctor.findById(doctorId).select('ratingAvg ratingCount');
  if (!doctor) return;
  const count = doctor.ratingCount || 0;
  const nextCount = Math.max(0, count + sign);
  const total = (doctor.ratingAvg || 0) * count + sign * rating;
  doctor.ratingCount = nextCount;
  doctor.ratingAvg = nextCount ? Math.min(5, Math.max(0, Math.round((total / nextCount) * 10) / 10)) : 0;
  await doctor.save();
}

// GET /api/feedback/pending  (patient): completed visits that have no review yet
const pending = asyncHandler(async (req, res) => {
  const done = await Appointment.find({ patient: req.user._id, status: 'completed' }).sort({ appointmentDate: -1 }).limit(30).populate('doctor', 'name specialization').select('appointmentId appointmentDate slotTime doctor').lean();
  const reviewed = new Set((await Feedback.find({ appointment: { $in: done.map((a) => a._id) } }).select('appointment').lean()).map((f) => String(f.appointment)));
  res.json({ success: true, data: { visits: done.filter((a) => !reviewed.has(String(a._id))).map((a) => ({ _id: a._id, appointmentId: a.appointmentId, appointmentDate: a.appointmentDate, slotTime: a.slotTime, doctor: a.doctor ? a.doctor.name : 'Doctor', specialization: a.doctor ? a.doctor.specialization : '' })) } });
});

// GET /api/feedback/mine  (patient)
const mine = asyncHandler(async (req, res) => {
  const items = await Feedback.find({ patient: req.user._id }).sort({ createdAt: -1 }).limit(30).populate('doctor', 'name').lean();
  res.json({ success: true, data: { reviews: items.map((f) => ({ _id: f._id, doctor: f.doctor ? f.doctor.name : 'Doctor', doctorRating: f.doctorRating, hospitalRating: f.hospitalRating, staffRating: f.staffRating, comment: f.comment || '', status: f.status, createdAt: f.createdAt })) } });
});

// POST /api/feedback  (patient) - only for the patient's own COMPLETED visit, once per visit
const create = asyncHandler(async (req, res) => {
  const appt = await Appointment.findOne({ _id: req.body.appointmentId, patient: req.user._id });
  if (!appt) throw ApiError.notFound('Visit not found.');
  if (appt.status !== 'completed') throw ApiError.badRequest('You can review a visit after it is completed.');
  if (await Feedback.exists({ appointment: appt._id })) throw ApiError.conflict('You already reviewed this visit.');

  let review;
  try {
    review = await Feedback.create({ patient: req.user._id, doctor: appt.doctor, appointment: appt._id, doctorRating: req.body.doctorRating, hospitalRating: req.body.hospitalRating, staffRating: req.body.staffRating, comment: req.body.comment || undefined });
  } catch (err) {
    if (err && err.code === 11000) throw ApiError.conflict('You already reviewed this visit.');
    throw err;
  }
  await applyRating(appt.doctor, review.doctorRating, +1);
  const doctor = await Doctor.findById(appt.doctor).select('user name');
  if (doctor && doctor.user) await notify(doctor.user, { type: 'general', title: 'New patient review', message: `A patient rated you ${review.doctorRating} out of 5.`, link: '/pages/doctor/dashboard.html' });
  await audit({ req, user: req.user._id, action: 'FEEDBACK_SUBMITTED', entity: 'Feedback', entityId: review._id, description: `Review for ${doctor ? doctor.name : 'doctor'}` });
  res.status(201).json({ success: true, message: 'Thank you for your review.' });
});

module.exports = { pending, mine, create, applyRating };

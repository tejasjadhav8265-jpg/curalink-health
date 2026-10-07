const Appointment = require('../models/Appointment');
const Teleconsultation = require('../models/Teleconsultation');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { todayIST } = require('../utils/dates');
const { notify } = require('../services/notificationService');
const { audit } = require('../services/auditService');

const MAX_MESSAGES = 200;

// Finds the video appointment and checks the logged-in user is the patient or the doctor on it.
// Anyone else gets "not found", so the existence of other people's visits is never revealed.
async function load(req) {
  const appt = await Appointment.findById(req.params.appointmentId)
    .populate('doctor', 'name user specialization').populate('patient', 'firstName lastName');
  if (!appt) throw ApiError.notFound('Appointment not found.');
  const me = String(req.user._id);
  const isPatient = appt.patient && String(appt.patient._id) === me;
  const isDoctor = appt.doctor && appt.doctor.user && String(appt.doctor.user) === me;
  if (!isPatient && !isDoctor) throw ApiError.notFound('Appointment not found.');
  if (appt.consultationType !== 'video') throw ApiError.badRequest('This is not a video appointment.');
  return { appt, isPatient: Boolean(isPatient), isDoctor: Boolean(isDoctor) };
}

const dueNow = (appt) => appt.status === 'confirmed' && appt.appointmentDate === todayIST();

function shape({ appt, isPatient, isDoctor }, session) {
  const me = isDoctor ? 'doctor' : 'patient';
  const doctorName = appt.doctor ? appt.doctor.name : 'Doctor';
  const patientName = appt.patient ? `${appt.patient.firstName} ${appt.patient.lastName}` : 'Patient';
  let reason = '';
  if (!session && !dueNow(appt)) reason = appt.status !== 'confirmed' ? 'The video room opens once the doctor confirms the appointment.' : 'The video room opens on the day of the appointment.';
  return {
    role: me,
    appointment: { _id: appt._id, appointmentId: appt.appointmentId, date: appt.appointmentDate, time: appt.slotTime, status: appt.status, doctor: doctorName, patient: patientName },
    session: session ? { status: session.status, startedAt: session.startedAt, endedAt: session.endedAt, messages: session.messages.map((m) => ({ mine: String(m.sender) === String(isDoctor ? appt.doctor.user : appt.patient._id), name: String(m.sender) === String(appt.patient._id) ? patientName : doctorName, text: m.text, sentAt: m.sentAt })) } : null,
    canStart: isDoctor && dueNow(appt) && (!session || session.status === 'scheduled'),
    reason,
  };
}

// GET /api/teleconsultations/:appointmentId
const view = asyncHandler(async (req, res) => {
  const ctx = await load(req);
  const session = await Teleconsultation.findOne({ appointment: ctx.appt._id });
  res.json({ success: true, data: shape(ctx, session) });
});

// POST /api/teleconsultations/:appointmentId/start  (doctor)
const start = asyncHandler(async (req, res) => {
  const ctx = await load(req);
  if (!ctx.isDoctor) throw ApiError.forbidden('Only the doctor can start the consultation.');
  if (!dueNow(ctx.appt)) throw ApiError.badRequest('A consultation can start on the day of a confirmed appointment.');
  let session = await Teleconsultation.findOne({ appointment: ctx.appt._id });
  if (session && session.status === 'ended') throw ApiError.conflict('This consultation has already ended.');
  if (!session) {
    try { session = await Teleconsultation.create({ appointment: ctx.appt._id, patient: ctx.appt.patient._id, doctor: ctx.appt.doctor._id, mode: 'video' }); }
    catch (err) { if (err && err.code === 11000) session = await Teleconsultation.findOne({ appointment: ctx.appt._id }); else throw err; }
  }
  if (session.status !== 'in-progress') { session.status = 'in-progress'; session.startedAt = new Date(); await session.save(); }
  await notify(ctx.appt.patient._id, { type: 'general', title: 'Your doctor is ready', message: `${ctx.appt.doctor.name} opened the video room. Join now.`, link: `/pages/patient/video-room.html?id=${ctx.appt._id}` });
  res.json({ success: true, message: 'The consultation room is open.' });
});

// POST /api/teleconsultations/:appointmentId/end  (doctor)
const end = asyncHandler(async (req, res) => {
  const ctx = await load(req);
  if (!ctx.isDoctor) throw ApiError.forbidden('Only the doctor can end the consultation.');
  const session = await Teleconsultation.findOne({ appointment: ctx.appt._id });
  if (!session || session.status !== 'in-progress') throw ApiError.badRequest('There is no consultation in progress.');
  session.status = 'ended'; session.endedAt = new Date();
  await session.save();
  await audit({ req, user: req.user._id, action: 'TELECONSULT_ENDED', entity: 'Teleconsultation', entityId: session._id, description: `Video consultation ended for ${ctx.appt.appointmentId}` });
  res.json({ success: true, message: 'Consultation ended. Remember to mark the appointment as completed and write the prescription.' });
});

// POST /api/teleconsultations/:appointmentId/messages  { text }
const send = asyncHandler(async (req, res) => {
  const ctx = await load(req);
  const result = await Teleconsultation.updateOne(
    { appointment: ctx.appt._id, status: 'in-progress', [`messages.${MAX_MESSAGES - 1}`]: { $exists: false } },
    { $push: { messages: { sender: req.user._id, text: req.body.text.trim() } } }
  );
  if (!result.matchedCount) throw ApiError.badRequest('Messages can only be sent while the consultation is in progress.');
  res.status(201).json({ success: true });
});

module.exports = { view, start, end, send };

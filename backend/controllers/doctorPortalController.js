const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const PatientRecord = require('../models/PatientRecord');
const MedicalReport = require('../models/MedicalReport');
const Prescription = require('../models/Prescription');
const ConsultationNote = require('../models/ConsultationNote');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { SLOT_HOLDING_STATUSES } = require('../utils/constants');
const { todayIST, nowTimeIST } = require('../utils/dates');
const { clampInt, escapeRegex } = require('../utils/text');
const { ACTIONS, checkDoctorAction } = require('../services/appointmentRules');
const { pathFor } = require('../middleware/upload');
const { audit } = require('../services/auditService');
const { notify } = require('../services/notificationService');

const HOLD = SLOT_HOLDING_STATUSES;
const RELATED = ['pending', 'rescheduled', 'confirmed', 'completed', 'no-show']; // appointments that make a patient "mine"
const FULL_ACCESS = ['confirmed', 'completed'];                                   // appointments that unlock the health record
const PATIENT_FIELDS = 'firstName lastName gender dob phone';

async function myDoctor(req) {
  const doctor = await Doctor.findOne({ user: req.user._id }).select('_id name user ratingAvg ratingCount');
  if (!doctor) throw ApiError.notFound('No doctor profile is linked to this account.');
  return doctor;
}

const ageOf = (dob) => {
  if (!dob) return null;
  const d = new Date(dob); const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 ? age : null;
};
const patientShape = (u) => (u ? { _id: u._id, name: `${u.firstName} ${u.lastName}`, gender: u.gender || '', age: ageOf(u.dob), phone: u.phone || '' } : { name: 'Patient' });
const apptShape = (a) => ({
  _id: a._id, appointmentId: a.appointmentId, appointmentDate: a.appointmentDate, slotTime: a.slotTime, consultationType: a.consultationType,
  reason: a.reason || '', status: a.status, paymentStatus: a.paymentStatus, tokenNumber: a.tokenNumber || '', patient: patientShape(a.patient),
  cancellationReason: a.cancellationReason || '', rescheduleCount: (a.rescheduleHistory || []).length,
});
const withPatient = (q) => q.populate('patient', PATIENT_FIELDS);

const todaysAppointments = (doctorId, today) =>
  withPatient(Appointment.find({ doctor: doctorId, appointmentDate: today, status: { $in: [...HOLD, 'completed', 'no-show'] } }).sort({ slotTime: 1 })).lean();

// GET /api/doctor/dashboard
const dashboard = asyncHandler(async (req, res) => {
  const doctor = await myDoctor(req);
  const today = todayIST();
  const [todayList, pendingCount, pendingList, upcoming, patientIds, unread] = await Promise.all([
    todaysAppointments(doctor._id, today),
    Appointment.countDocuments({ doctor: doctor._id, status: { $in: ['pending', 'rescheduled'] }, appointmentDate: { $gte: today } }),
    withPatient(Appointment.find({ doctor: doctor._id, status: { $in: ['pending', 'rescheduled'] }, appointmentDate: { $gte: today } }).sort({ appointmentDate: 1, slotTime: 1 }).limit(6)).lean(),
    Appointment.countDocuments({ doctor: doctor._id, status: { $in: HOLD }, appointmentDate: { $gt: today } }),
    Appointment.distinct('patient', { doctor: doctor._id, status: { $in: RELATED } }),
    Notification.countDocuments({ user: req.user._id, isRead: false }),
  ]);
  const next = todayList.find((a) => a.status === 'confirmed') || null; // first confirmed patient still to be seen
  res.json({
    success: true,
    data: {
      doctor: { name: doctor.name, ratingAvg: doctor.ratingAvg, ratingCount: doctor.ratingCount },
      stats: {
        today: todayList.filter((a) => a.status !== 'no-show').length, completedToday: todayList.filter((a) => a.status === 'completed').length,
        pending: pendingCount, upcoming, patients: patientIds.length, unreadNotifications: unread,
      },
      next: next ? apptShape(next) : null,
      today: todayList.map(apptShape), pending: pendingList.map(apptShape),
    },
  });
});

// GET /api/doctor/queue  - today's token queue
const queue = asyncHandler(async (req, res) => {
  const doctor = await myDoctor(req);
  const list = (await todaysAppointments(doctor._id, todayIST())).map(apptShape);
  const waiting = list.filter((a) => ['pending', 'confirmed', 'rescheduled'].includes(a.status));
  res.json({ success: true, data: { date: todayIST(), appointments: list, counts: { waiting: waiting.length, completed: list.filter((a) => a.status === 'completed').length, total: list.length }, nowServing: (list.find((a) => a.status === 'confirmed') || {}).tokenNumber || null } });
});

function tabFilter(tab, today) {
  switch (tab) {
    case 'today': return { appointmentDate: today, status: { $in: [...HOLD, 'completed', 'no-show'] } };
    case 'pending': return { status: { $in: ['pending', 'rescheduled'] }, appointmentDate: { $gte: today } };
    case 'history': return { status: { $in: ['completed', 'no-show'] } };
    case 'cancelled': return { status: { $in: ['cancelled', 'rejected'] } };
    default: return { status: { $in: HOLD }, appointmentDate: { $gte: today } }; // upcoming
  }
}

// GET /api/doctor/appointments?tab=today|pending|upcoming|history|cancelled&page=1&limit=10
const appointments = asyncHandler(async (req, res) => {
  const doctor = await myDoctor(req);
  const today = todayIST();
  const tab = ['today', 'pending', 'upcoming', 'history', 'cancelled'].includes(req.query.tab) ? req.query.tab : 'today';
  const page = clampInt(req.query.page, 1, 10000, 1);
  const limit = clampInt(req.query.limit, 1, 50, 10);
  const filter = { doctor: doctor._id, ...tabFilter(tab, today) };
  const asc = ['today', 'pending', 'upcoming'].includes(tab);
  const sort = asc ? { appointmentDate: 1, slotTime: 1 } : { appointmentDate: -1, slotTime: -1 };

  const tabs = ['today', 'pending', 'upcoming', 'history', 'cancelled'];
  const [total, items, ...counts] = await Promise.all([
    Appointment.countDocuments(filter),
    withPatient(Appointment.find(filter).sort(sort).skip((page - 1) * limit).limit(limit)).lean(),
    ...tabs.map((t) => Appointment.countDocuments({ doctor: doctor._id, ...tabFilter(t, today) })),
  ]);
  res.json({ success: true, data: { appointments: items.map(apptShape), counts: Object.fromEntries(tabs.map((t, i) => [t, counts[i]])), pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } } });
});

// PUT /api/doctor/appointments/:id/status  { action: confirm|reject|complete|no-show|cancel, reason }
const updateStatus = asyncHandler(async (req, res) => {
  const doctor = await myDoctor(req);
  const { action } = req.body;
  const appt = await Appointment.findOne({ _id: req.params.id, doctor: doctor._id });
  if (!appt) throw ApiError.notFound('Appointment not found.');

  const problem = checkDoctorAction({ action, appt, today: todayIST(), nowHM: nowTimeIST() });
  if (problem) throw ApiError.badRequest(problem);
  const rule = ACTIONS[action];
  const reason = (req.body.reason || '').trim();
  if (rule.reason && reason.length < 3) throw ApiError.badRequest('Please give a reason (at least 3 characters).');

  const when = `${appt.appointmentDate} at ${appt.slotTime}`;
  appt.status = rule.to; // save() below also releases the slot when the new status no longer holds it
  let refunded = false;
  if (rule.reason) {
    appt.cancellationReason = reason; appt.cancelledAt = new Date(); appt.cancelledBy = req.user._id;
    if (appt.paymentStatus === 'paid') { // demo refund
      await Payment.updateMany({ appointment: appt._id, status: 'paid' }, { $set: { status: 'refunded' } });
      appt.paymentStatus = 'refunded'; refunded = true;
    }
  }
  await appt.save();

  const refundText = refunded ? ' Your demo payment is marked as refunded.' : '';
  const messages = {
    confirm: ['doctor_response', 'Appointment confirmed', `${doctor.name} confirmed your appointment on ${when}.`],
    reject: ['doctor_response', 'Appointment declined', `${doctor.name} could not accept your appointment on ${when}. Reason: ${reason}.${refundText}`],
    cancel: ['appointment_cancellation', 'Appointment cancelled by doctor', `${doctor.name} cancelled your appointment on ${when}. Reason: ${reason}.${refundText}`],
    complete: ['general', 'Visit completed', `Your visit with ${doctor.name} on ${appt.appointmentDate} is marked completed. Any prescription will appear in your account.`],
    'no-show': ['general', 'Missed appointment', `Your appointment with ${doctor.name} on ${when} was marked as missed.`],
  };
  const [type, title, message] = messages[action];
  await notify(appt.patient, { type, title, message, link: `/pages/patient/appointment-details.html?id=${appt._id}` });
  await audit({ req, user: req.user._id, action: `APPOINTMENT_${action.toUpperCase().replace('-', '_')}`, entity: 'Appointment', entityId: appt._id, description: `${doctor.name}: ${action} ${appt.appointmentId}${reason ? ` (${reason})` : ''}` });

  const saved = await withPatient(Appointment.findById(appt._id)).lean();
  res.json({ success: true, message: `Appointment ${rule.to === 'no-show' ? 'marked as no-show' : rule.to}.`, data: { appointment: apptShape(saved) } });
});

// Does this doctor have a relationship with the patient, and does it unlock the health record?
async function accessTo(doctorId, patientId) {
  const rows = await Appointment.find({ doctor: doctorId, patient: patientId, status: { $in: RELATED } }).select('status').lean();
  return { related: rows.length > 0, full: rows.some((r) => FULL_ACCESS.includes(r.status)) };
}

const reportShape = (r) => ({ _id: r._id, fileName: r.fileName, fileType: r.fileType, size: r.size, description: r.description || '', uploadDate: r.uploadDate });

// Health summary and reports for a patient the doctor is allowed to see.
async function healthFor(patientId) {
  const [record, reports] = await Promise.all([
    PatientRecord.findOne({ patient: patientId }).lean(),
    MedicalReport.find({ patient: patientId }).sort({ uploadDate: -1 }).lean(),
  ]);
  return {
    record: { bloodGroup: (record && record.bloodGroup) || '', allergies: (record && record.allergies) || [], chronicConditions: (record && record.chronicConditions) || [], notes: (record && record.notes) || '' },
    reports: reports.map(reportShape),
  };
}

// GET /api/doctor/patients?q=&page=
const patients = asyncHandler(async (req, res) => {
  const doctor = await myDoctor(req);
  const today = todayIST();
  const page = clampInt(req.query.page, 1, 10000, 1);
  const limit = clampInt(req.query.limit, 1, 50, 12);
  const q = String(req.query.q || '').trim().slice(0, 60);

  const pipeline = [
    { $match: { doctor: doctor._id, status: { $in: RELATED } } },
    { $group: {
      _id: '$patient', bookings: { $sum: 1 },
      visits: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
      lastVisit: { $max: { $cond: [{ $eq: ['$status', 'completed'] }, '$appointmentDate', null] } },
      nextVisit: { $min: { $cond: [{ $and: [{ $in: ['$status', HOLD] }, { $gte: ['$appointmentDate', today] }] }, '$appointmentDate', null] } },
    } },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
    { $unwind: '$u' },
    { $addFields: { name: { $concat: ['$u.firstName', ' ', '$u.lastName'] } } },
  ];
  if (q) pipeline.push({ $match: { name: { $regex: escapeRegex(q), $options: 'i' } } });
  pipeline.push({ $sort: { lastVisit: -1, name: 1 } });
  pipeline.push({ $facet: {
    items: [{ $skip: (page - 1) * limit }, { $limit: limit }, { $project: { name: 1, bookings: 1, visits: 1, lastVisit: 1, nextVisit: 1, gender: '$u.gender', dob: '$u.dob', phone: '$u.phone', city: '$u.city' } }],
    total: [{ $count: 'n' }],
  } });

  const [out] = await Appointment.aggregate(pipeline);
  const total = (out.total[0] && out.total[0].n) || 0;
  res.json({
    success: true,
    data: {
      patients: out.items.map((p) => ({ _id: p._id, name: p.name, gender: p.gender || '', age: ageOf(p.dob), phone: p.phone || '', city: p.city || '', bookings: p.bookings, visits: p.visits, lastVisit: p.lastVisit || '', nextVisit: p.nextVisit || '' })),
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    },
  });
});

// GET /api/doctor/patients/:patientId
const patientDetails = asyncHandler(async (req, res) => {
  const doctor = await myDoctor(req);
  const { patientId } = req.params;
  const access = await accessTo(doctor._id, patientId);
  if (!access.related) throw ApiError.notFound('Patient not found.'); // never reveal patients who are not yours

  const user = await User.findOne({ _id: patientId, role: 'patient' }).select(`${PATIENT_FIELDS} city emergencyContact`).lean();
  if (!user) throw ApiError.notFound('Patient not found.');

  const [history, prescriptions, notes] = await Promise.all([
    Appointment.find({ doctor: doctor._id, patient: patientId }).sort({ appointmentDate: -1, slotTime: -1 }).limit(30).lean(),
    Prescription.find({ doctor: doctor._id, patient: patientId }).sort({ createdAt: -1 }).limit(20).select('prescriptionId diagnosis createdAt medicines appointment').lean(),
    ConsultationNote.find({ doctor: doctor._id, patient: patientId }).sort({ createdAt: -1 }).limit(10).select('note symptoms observations createdAt appointment').lean(),
  ]);
  const data = {
    patient: { ...patientShape(user), city: user.city || '', emergencyContact: user.emergencyContact || '' },
    fullAccess: access.full,
    history: history.map((a) => ({ _id: a._id, appointmentDate: a.appointmentDate, slotTime: a.slotTime, status: a.status, reason: a.reason || '', tokenNumber: a.tokenNumber || '' })),
    prescriptions: prescriptions.map((p) => ({ _id: p._id, prescriptionId: p.prescriptionId, diagnosis: p.diagnosis, createdAt: p.createdAt, medicineCount: p.medicines.length, appointment: p.appointment })),
    notes: notes.map((n) => ({ _id: n._id, note: n.note, symptoms: n.symptoms || '', observations: n.observations || '', createdAt: n.createdAt })),
  };
  if (access.full) {
    Object.assign(data, await healthFor(patientId));
    await audit({ req, user: req.user._id, action: 'PATIENT_RECORD_VIEWED', entity: 'User', entityId: patientId, description: `${doctor.name} viewed a patient's health record` });
  }
  res.json({ success: true, data });
});

// GET /api/doctor/patients/:patientId/reports/:reportId/download
const downloadPatientReport = asyncHandler(async (req, res) => {
  const doctor = await myDoctor(req);
  const { patientId, reportId } = req.params;
  const access = await accessTo(doctor._id, patientId);
  if (!access.full) throw ApiError.notFound('Report not found.');
  const report = await MedicalReport.findOne({ _id: reportId, patient: patientId }).select('+storedName');
  if (!report) throw ApiError.notFound('Report not found.');
  await audit({ req, user: req.user._id, action: 'REPORT_VIEWED_BY_DOCTOR', entity: 'MedicalReport', entityId: report._id, description: `${doctor.name} downloaded ${report.fileName}` });
  res.setHeader('Content-Type', report.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.download(pathFor(report.storedName), report.fileName, (err) => {
    if (err && !res.headersSent) res.status(404).json({ success: false, message: 'This file is no longer available.' });
  });
});

async function ownAppointment(req) {
  const doctor = await myDoctor(req);
  const appt = await withPatient(Appointment.findOne({ _id: req.params.id, doctor: doctor._id }));
  if (!appt) throw ApiError.notFound('Appointment not found.');
  return { doctor, appt };
}

// GET /api/doctor/appointments/:id  - everything the consultation page needs
const consultation = asyncHandler(async (req, res) => {
  const { doctor, appt } = await ownAppointment(req);
  const full = FULL_ACCESS.includes(appt.status);
  const [note, prescription] = await Promise.all([
    ConsultationNote.findOne({ appointment: appt._id }).lean(),
    Prescription.findOne({ appointment: appt._id, doctor: doctor._id }).lean(),
  ]);
  const data = {
    appointment: apptShape(appt), fullAccess: full,
    note: note ? { symptoms: note.symptoms || '', observations: note.observations || '', note: note.note, updatedAt: note.updatedAt } : null,
    prescription: prescription ? { _id: prescription._id, prescriptionId: prescription.prescriptionId, diagnosis: prescription.diagnosis, medicines: prescription.medicines, advice: prescription.advice || '', followUpDate: prescription.followUpDate || '' } : null,
  };
  if (full) {
    Object.assign(data, await healthFor(appt.patient._id));
    await audit({ req, user: req.user._id, action: 'PATIENT_RECORD_VIEWED', entity: 'User', entityId: appt.patient._id, description: `${doctor.name} opened a consultation (${appt.appointmentId})` });
  }
  res.json({ success: true, data });
});

// PUT /api/doctor/appointments/:id/consultation  { symptoms, observations, note }
const saveConsultation = asyncHandler(async (req, res) => {
  const { doctor, appt } = await ownAppointment(req);
  if (!FULL_ACCESS.includes(appt.status)) throw ApiError.badRequest('Please confirm this appointment before writing notes.');
  const { symptoms, observations, note } = req.body;
  const saved = await ConsultationNote.findOneAndUpdate(
    { appointment: appt._id },
    { $set: { symptoms: symptoms || '', observations: observations || '', note }, $setOnInsert: { appointment: appt._id, doctor: doctor._id, patient: appt.patient._id } },
    { upsert: true, new: true, runValidators: true }
  );
  await audit({ req, user: req.user._id, action: 'CONSULTATION_NOTE_SAVED', entity: 'ConsultationNote', entityId: saved._id, description: `${doctor.name} saved notes for ${appt.appointmentId}` });
  res.json({ success: true, message: 'Consultation note saved.', data: { updatedAt: saved.updatedAt } });
});

module.exports = { dashboard, queue, appointments, updateStatus, patients, patientDetails, downloadPatientReport, consultation, saveConsultation };

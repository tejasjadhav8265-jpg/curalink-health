const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const Department = require('../models/Department');
const User = require('../models/User');
const Payment = require('../models/Payment');
const AuditLog = require('../models/AuditLog');
const DoctorSearch = require('../models/DoctorSearch');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { SLOT_HOLDING_STATUSES } = require('../utils/constants');
const { todayIST, nowTimeIST } = require('../utils/dates');
const { clampInt, escapeRegex } = require('../utils/text');
const { checkDoctorAction } = require('../services/appointmentRules');
const { lastDates, fillSeries, rate, clampDays, istStart, istEnd, topWithOther } = require('../services/analyticsRules');
const { audit } = require('../services/auditService');
const { notify } = require('../services/notificationService');

const HOLD = SLOT_HOLDING_STATUSES;
const NOT_DROPPED = { $nin: ['cancelled', 'rejected'] };

// GET /api/admin/dashboard
const dashboard = asyncHandler(async (req, res) => {
  const today = todayIST();
  const [patients, doctors, inactiveDoctors, departments, todayCount, pending, total, revenue, recent, recentAudit] = await Promise.all([
    User.countDocuments({ role: 'patient', isActive: true }),
    Doctor.countDocuments({ status: 'active' }),
    Doctor.countDocuments({ status: 'inactive' }),
    Department.countDocuments({ status: 'active' }),
    Appointment.countDocuments({ appointmentDate: today, status: { $in: [...HOLD, 'completed', 'no-show'] } }),
    Appointment.countDocuments({ status: { $in: ['pending', 'rescheduled'] }, appointmentDate: { $gte: today } }),
    Appointment.countDocuments({}),
    Payment.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, sum: { $sum: '$amount' } } }]),
    Appointment.find().sort({ createdAt: -1 }).limit(6).populate('patient', 'firstName lastName').populate('doctor', 'name').select('appointmentId appointmentDate slotTime status patient doctor createdAt').lean(),
    AuditLog.find().sort({ timestamp: -1 }).limit(6).populate('user', 'firstName lastName role').lean(),
  ]);
  res.json({
    success: true,
    data: {
      stats: { patients, doctors, inactiveDoctors, departments, today: todayCount, pending, totalAppointments: total, revenue: (revenue[0] && revenue[0].sum) || 0 },
      recentAppointments: recent.map((a) => ({ _id: a._id, appointmentId: a.appointmentId, appointmentDate: a.appointmentDate, slotTime: a.slotTime, status: a.status, patient: a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : 'Patient', doctor: a.doctor ? a.doctor.name : 'Doctor' })),
      recentAudit: recentAudit.map((l) => ({ _id: l._id, action: l.action, description: l.description || '', timestamp: l.timestamp, by: l.user ? `${l.user.firstName} ${l.user.lastName}` : 'System', role: l.user ? l.user.role : '' })),
    },
  });
});

const apptRow = (a) => ({
  _id: a._id, appointmentId: a.appointmentId, appointmentDate: a.appointmentDate, slotTime: a.slotTime, status: a.status, paymentStatus: a.paymentStatus, consultationType: a.consultationType, tokenNumber: a.tokenNumber || '',
  patient: a.patient ? { name: `${a.patient.firstName} ${a.patient.lastName}`, phone: a.patient.phone } : { name: 'Patient', phone: '' },
  doctor: a.doctor ? { name: a.doctor.name, specialization: a.doctor.specialization } : { name: 'Doctor', specialization: '' },
  cancellationReason: a.cancellationReason || '',
});

// GET /api/admin/appointments?status=&date=&doctor=&q=&page=
const appointments = asyncHandler(async (req, res) => {
  const page = clampInt(req.query.page, 1, 10000, 1);
  const limit = clampInt(req.query.limit, 1, 50, 12);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.date) filter.appointmentDate = req.query.date;
  if (req.query.doctor) filter.doctor = req.query.doctor;
  const q = String(req.query.q || '').trim().slice(0, 60);
  if (q) {
    if (/^apt-/i.test(q)) filter.appointmentId = new RegExp(`^${escapeRegex(q)}`, 'i');
    else {
      const rx = new RegExp(escapeRegex(q), 'i');
      const ids = await User.find({ role: 'patient', $or: [{ firstName: rx }, { lastName: rx }, { email: rx }, { phone: rx }] }).select('_id').limit(100).lean();
      filter.patient = { $in: ids.map((u) => u._id) };
    }
  }
  const [total, items] = await Promise.all([
    Appointment.countDocuments(filter),
    Appointment.find(filter).sort({ appointmentDate: -1, slotTime: -1 }).skip((page - 1) * limit).limit(limit)
      .populate('patient', 'firstName lastName phone').populate('doctor', 'name specialization').lean(),
  ]);
  res.json({ success: true, data: { appointments: items.map(apptRow), pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } } });
});

// PUT /api/admin/appointments/:id/cancel  { reason }
const cancelAppointment = asyncHandler(async (req, res) => {
  const appt = await Appointment.findById(req.params.id);
  if (!appt) throw ApiError.notFound('Appointment not found.');
  const problem = checkDoctorAction({ action: 'cancel', appt, today: todayIST(), nowHM: nowTimeIST() });
  if (problem) throw ApiError.badRequest(problem);

  const reason = req.body.reason.trim();
  appt.status = 'cancelled'; // save() releases the slot
  appt.cancellationReason = `Cancelled by the hospital: ${reason}`.slice(0, 300);
  appt.cancelledAt = new Date();
  appt.cancelledBy = req.user._id;
  let refunded = false;
  if (appt.paymentStatus === 'paid') {
    await Payment.updateMany({ appointment: appt._id, status: 'paid' }, { $set: { status: 'refunded' } });
    appt.paymentStatus = 'refunded'; refunded = true;
  }
  await appt.save();

  const doctor = await Doctor.findById(appt.doctor).select('name user');
  const when = `${appt.appointmentDate} at ${appt.slotTime}`;
  await notify(appt.patient, { type: 'appointment_cancellation', title: 'Appointment cancelled by the hospital', message: `Your appointment with ${doctor ? doctor.name : 'the doctor'} on ${when} was cancelled. Reason: ${reason}.${refunded ? ' Your demo payment is marked as refunded.' : ''}`, link: `/pages/patient/appointment-details.html?id=${appt._id}` });
  if (doctor && doctor.user) await notify(doctor.user, { type: 'appointment_cancellation', title: 'Appointment cancelled by the hospital', message: `The appointment on ${when} was cancelled. Reason: ${reason}.`, link: '/pages/doctor/appointments.html' });
  await audit({ req, user: req.user._id, action: 'APPOINTMENT_CANCELLED_BY_ADMIN', entity: 'Appointment', entityId: appt._id, description: `${appt.appointmentId}: ${reason}` });
  res.json({ success: true, message: 'Appointment cancelled. The patient and doctor were notified.' });
});

// GET /api/admin/analytics?days=7|30|90
const analytics = asyncHandler(async (req, res) => {
  const days = clampDays(req.query.days);
  const today = todayIST();
  const dates = lastDates(today, days);
  const start = dates[0];
  const inRange = { appointmentDate: { $gte: start, $lte: today } };
  const since = { $gte: istStart(start), $lte: istEnd(today) };
  const dayOf = (field) => ({ $dateToString: { format: '%Y-%m-%d', date: field, timezone: 'Asia/Kolkata' } });
  const topBy = (pipelineKey) => [{ $group: { _id: pipelineKey, n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 40 }];

  const [daily, statusRows, deptRows, doctorRows, typeRows, revenueRows, patientRows, specRows, keywordRows, searchTotals] = await Promise.all([
    Appointment.aggregate([{ $match: { ...inRange, status: NOT_DROPPED } }, { $group: { _id: '$appointmentDate', n: { $sum: 1 } } }]),
    Appointment.aggregate([{ $match: inRange }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Appointment.aggregate([{ $match: { ...inRange, status: NOT_DROPPED } }, { $group: { _id: '$department', n: { $sum: 1 } } }, { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'd' } }, { $project: { n: 1, name: { $ifNull: [{ $arrayElemAt: ['$d.name', 0] }, 'Unassigned'] } } }]),
    Appointment.aggregate([{ $match: { ...inRange, status: NOT_DROPPED } }, { $group: { _id: '$doctor', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 6 }, { $lookup: { from: 'doctors', localField: '_id', foreignField: '_id', as: 'd' } }, { $project: { n: 1, name: { $ifNull: [{ $arrayElemAt: ['$d.name', 0] }, 'Doctor'] } } }]),
    Appointment.aggregate([{ $match: { ...inRange, status: NOT_DROPPED } }, { $group: { _id: '$consultationType', n: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { status: { $in: ['paid', 'refunded'] }, paidAt: since } }, { $group: { _id: dayOf('$paidAt'), n: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] } } } }]),
    User.aggregate([{ $match: { role: 'patient', createdAt: since } }, { $group: { _id: dayOf('$createdAt'), n: { $sum: 1 } } }]),
    DoctorSearch.aggregate([{ $match: { createdAt: since, specialization: { $nin: [null, ''] } } }, ...topBy('$specialization')]),
    DoctorSearch.aggregate([{ $match: { createdAt: since, keyword: { $nin: [null, ''] } } }, ...topBy('$keyword')]),
    DoctorSearch.aggregate([{ $match: { createdAt: since } }, { $group: { _id: null, total: { $sum: 1 }, empty: { $sum: { $cond: [{ $eq: ['$resultsCount', 0] }, 1, 0] } }, clicked: { $sum: { $cond: [{ $ifNull: ['$clickedDoctor', false] }, 1, 0] } } } }]),
  ]);

  const status = Object.fromEntries(statusRows.map((r) => [r._id, r.n]));
  const totalAppts = statusRows.reduce((t, r) => t + r.n, 0);
  const dropped = (status.cancelled || 0) + (status.rejected || 0);
  const s = searchTotals[0] || { total: 0, empty: 0, clicked: 0 };
  const order = ['completed', 'confirmed', 'pending', 'rescheduled', 'no-show', 'cancelled', 'rejected'];
  const revenueDaily = fillSeries(revenueRows, dates);

  res.json({
    success: true,
    data: {
      days, from: start, to: today,
      totals: {
        appointments: totalAppts, completed: status.completed || 0, cancelRate: rate(dropped, totalAppts), noShowRate: rate(status['no-show'] || 0, totalAppts),
        revenue: revenueDaily.reduce((t, p) => t + p.value, 0), newPatients: patientRows.reduce((t, r) => t + r.n, 0),
      },
      appointmentsDaily: fillSeries(daily, dates),
      revenueDaily,
      newPatientsDaily: fillSeries(patientRows, dates),
      byStatus: order.filter((k) => status[k]).map((k) => ({ label: k, value: status[k] })),
      byDepartment: topWithOther(deptRows.map((r) => ({ _id: r.name, n: r.n })), 7),
      topDoctors: doctorRows.map((r) => ({ label: r.name, value: r.n })),
      byType: ['in-person', 'video'].map((k) => ({ label: k, value: (typeRows.find((r) => r._id === k) || {}).n || 0 })),
      searches: {
        total: s.total, noResultsRate: rate(s.empty, s.total), clickRate: rate(s.clicked, s.total),
        topSpecializations: topWithOther(specRows, 8).filter((x) => x.label !== 'Other'),
        topKeywords: topWithOther(keywordRows, 8).filter((x) => x.label !== 'Other'),
      },
    },
  });
});

// GET /api/admin/audit-logs?action=&q=&from=&to=&page=
const auditLogs = asyncHandler(async (req, res) => {
  const page = clampInt(req.query.page, 1, 10000, 1);
  const limit = clampInt(req.query.limit, 1, 50, 20);
  const filter = {};
  if (req.query.action) filter.action = req.query.action;
  const q = String(req.query.q || '').trim().slice(0, 60);
  if (q) filter.description = new RegExp(escapeRegex(q), 'i');
  if (req.query.from || req.query.to) {
    filter.timestamp = {};
    if (req.query.from) filter.timestamp.$gte = istStart(req.query.from);
    if (req.query.to) filter.timestamp.$lte = istEnd(req.query.to);
  }
  const [total, logs, actions] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.find(filter).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).populate('user', 'firstName lastName role').lean(),
    AuditLog.distinct('action'),
  ]);
  res.json({
    success: true,
    data: {
      logs: logs.map((l) => ({ _id: l._id, action: l.action, entity: l.entity || '', description: l.description || '', ip: l.ip || '', timestamp: l.timestamp, by: l.user ? `${l.user.firstName} ${l.user.lastName}` : 'System', role: l.user ? l.user.role : '' })),
      actions: actions.sort(),
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    },
  });
});

module.exports = { dashboard, appointments, cancelAppointment, analytics, auditLogs };

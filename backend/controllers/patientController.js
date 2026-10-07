const User = require('../models/User');
const PatientRecord = require('../models/PatientRecord');
const Appointment = require('../models/Appointment');
const MedicalReport = require('../models/MedicalReport');
const Prescription = require('../models/Prescription');
const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { SLOT_HOLDING_STATUSES } = require('../utils/constants');
const { todayIST, nowTimeIST } = require('../utils/dates');
const { queueFor } = require('../services/queueService');
const { audit } = require('../services/auditService');
const { signToken, setAuthCookie } = require('../middleware/auth');

const dateOnly = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

const profileOf = (u) => ({
  id: u._id, firstName: u.firstName, lastName: u.lastName, fullName: `${u.firstName} ${u.lastName}`,
  email: u.email, role: u.role, phone: u.phone, dob: dateOnly(u.dob), gender: u.gender || '',
  address: u.address || '', city: u.city || '', state: u.state || '', emergencyContact: u.emergencyContact || '',
});

// GET /api/patients/profile
const getProfile = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { profile: profileOf(req.user) } });
});

// PUT /api/patients/profile  (email and role can never be changed here)
const updateProfile = asyncHandler(async (req, res) => {
  const user = req.user;
  const b = req.body;
  user.firstName = b.firstName; user.lastName = b.lastName; user.phone = b.phone;
  user.dob = new Date(b.dob); user.gender = b.gender;
  user.address = b.address || ''; user.city = b.city; user.state = b.state;
  user.emergencyContact = b.emergencyContact || undefined;
  await user.save(); // a phone number already used by someone else becomes a friendly 409
  await audit({ req, user: user._id, action: 'PROFILE_UPDATED', entity: 'User', entityId: user._id, description: 'Patient updated their profile' });
  res.json({ success: true, message: 'Your profile was updated.', data: { profile: profileOf(user) } });
});

// PUT /api/patients/password
const changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await user.comparePassword(req.body.currentPassword))) throw ApiError.badRequest('Your current password is incorrect.');
  user.passwordHash = await User.hashPassword(req.body.newPassword);
  user.tokenVersion = (user.tokenVersion || 0) + 1; // signs out every other device
  await user.save();
  setAuthCookie(res, signToken(user)); // this device stays signed in
  await audit({ req, user: user._id, action: 'PASSWORD_CHANGED', entity: 'User', entityId: user._id, description: 'Patient changed their password' });
  res.json({ success: true, message: 'Your password was changed. Other devices were signed out.' });
});

const cleanList = (list) => [...new Set((list || []).map((s) => String(s).trim()).filter(Boolean))].slice(0, 20);
const recordOf = (r) => ({
  bloodGroup: r.bloodGroup || '', allergies: r.allergies || [], chronicConditions: r.chronicConditions || [],
  notes: r.notes || '', updatedAt: r.updatedAt,
});

// GET /api/patients/record
const getRecord = asyncHandler(async (req, res) => {
  const record = await PatientRecord.findOneAndUpdate({ patient: req.user._id }, { $setOnInsert: { patient: req.user._id } }, { upsert: true, new: true });
  res.json({ success: true, data: { record: recordOf(record) } });
});

// PUT /api/patients/record
const updateRecord = asyncHandler(async (req, res) => {
  const b = req.body;
  const set = {};
  if (b.bloodGroup !== undefined) set.bloodGroup = b.bloodGroup;
  if (b.allergies !== undefined) set.allergies = cleanList(b.allergies);
  if (b.chronicConditions !== undefined) set.chronicConditions = cleanList(b.chronicConditions);
  if (b.notes !== undefined) set.notes = b.notes || '';
  const record = await PatientRecord.findOneAndUpdate({ patient: req.user._id }, { $set: set, $setOnInsert: { patient: req.user._id } }, { upsert: true, new: true, runValidators: true });
  await audit({ req, user: req.user._id, action: 'HEALTH_SUMMARY_UPDATED', entity: 'PatientRecord', entityId: record._id, description: 'Patient updated their health summary' });
  res.json({ success: true, message: 'Your health summary was saved.', data: { record: recordOf(record) } });
});

// GET /api/patients/dashboard - everything the dashboard needs in one call
const dashboard = asyncHandler(async (req, res) => {
  const uid = req.user._id;
  const today = todayIST();
  const nowHM = nowTimeIST();
  const holding = { $in: SLOT_HOLDING_STATUSES };

  const [candidates, upcomingTotal, pastTotal, unread, recentNotifications, recentPrescriptions, prescriptionCount, reportCount, unpaid] = await Promise.all([
    Appointment.find({ patient: uid, status: holding, appointmentDate: { $gte: today } })
      .sort({ appointmentDate: 1, slotTime: 1 }).limit(10)
      .populate('doctor', 'name specialization location profileImage consultationFee').select('-__v').lean(),
    Appointment.countDocuments({ patient: uid, status: holding, appointmentDate: { $gte: today } }),
    Appointment.countDocuments({ patient: uid, status: { $in: ['completed', 'no-show'] } }),
    Notification.countDocuments({ user: uid, isRead: false }),
    Notification.find({ user: uid }).sort({ createdAt: -1 }).limit(4).select('type title message link isRead createdAt').lean(),
    Prescription.find({ patient: uid }).sort({ createdAt: -1 }).limit(3).populate('doctor', 'name specialization').select('prescriptionId diagnosis doctor createdAt medicines').lean(),
    Prescription.countDocuments({ patient: uid }),
    MedicalReport.countDocuments({ patient: uid }),
    Appointment.countDocuments({ patient: uid, status: holding, appointmentDate: { $gte: today }, paymentStatus: { $in: ['pending', 'failed'] } }),
  ]);

  // A visit earlier today has already passed; skip it when choosing "next".
  const next = candidates.find((a) => a.appointmentDate > today || a.slotTime > nowHM) || null;
  const queue = next ? await queueFor({ ...next, doctor: next.doctor && next.doctor._id }) : null;

  res.json({
    success: true,
    data: {
      user: { firstName: req.user.firstName },
      nextAppointment: next, queue,
      stats: { upcoming: upcomingTotal, past: pastTotal, unreadNotifications: unread, prescriptions: prescriptionCount, reports: reportCount, unpaid },
      recentNotifications,
      recentPrescriptions: recentPrescriptions.map((p) => ({ _id: p._id, prescriptionId: p.prescriptionId, diagnosis: p.diagnosis, doctor: p.doctor, createdAt: p.createdAt, medicineCount: p.medicines.length })),
    },
  });
});

module.exports = { getProfile, updateProfile, changePassword, getRecord, updateRecord, dashboard };

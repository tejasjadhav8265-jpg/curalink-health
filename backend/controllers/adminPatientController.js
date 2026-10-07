const User = require('../models/User');
const Appointment = require('../models/Appointment');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { clampInt, escapeRegex } = require('../utils/text');
const { audit } = require('../services/auditService');

// Admins manage accounts. They do NOT read medical records or reports (that stays between patient and doctor).
const card = (u, count) => ({ _id: u._id, name: `${u.firstName} ${u.lastName}`, email: u.email, phone: u.phone, city: u.city || '', isActive: u.isActive, createdAt: u.createdAt, appointments: count || 0 });

// GET /api/admin/patients?q=&status=&page=
const list = asyncHandler(async (req, res) => {
  const page = clampInt(req.query.page, 1, 10000, 1);
  const limit = clampInt(req.query.limit, 1, 50, 10);
  const filter = { role: 'patient' };
  if (req.query.status) filter.isActive = req.query.status === 'active';
  const q = String(req.query.q || '').trim().slice(0, 60);
  if (q) { const rx = new RegExp(escapeRegex(q), 'i'); filter.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }, { phone: rx }]; }

  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select('firstName lastName email phone city isActive createdAt').lean(),
  ]);
  const counts = await Appointment.aggregate([{ $match: { patient: { $in: users.map((u) => u._id) } } }, { $group: { _id: '$patient', n: { $sum: 1 } } }]);
  const byId = new Map(counts.map((c) => [String(c._id), c.n]));
  res.json({ success: true, data: { patients: users.map((u) => card(u, byId.get(String(u._id)))), pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } } });
});

// GET /api/admin/patients/:id
const getOne = asyncHandler(async (req, res) => {
  const u = await User.findOne({ _id: req.params.id, role: 'patient' }).select('firstName lastName email phone city state gender dob address emergencyContact isActive createdAt').lean();
  if (!u) throw ApiError.notFound('Patient not found.');
  const [recent, total] = await Promise.all([
    Appointment.find({ patient: u._id }).sort({ appointmentDate: -1, slotTime: -1 }).limit(8).populate('doctor', 'name specialization').select('appointmentId appointmentDate slotTime status doctor').lean(),
    Appointment.countDocuments({ patient: u._id }),
  ]);
  res.json({ success: true, data: { patient: { ...card(u, total), gender: u.gender || '', dob: u.dob ? new Date(u.dob).toISOString().slice(0, 10) : '', address: u.address || '', state: u.state || '', emergencyContact: u.emergencyContact || '' }, recent } });
});

// PATCH /api/admin/patients/:id/status  { isActive: true | false }
const setStatus = asyncHandler(async (req, res) => {
  const u = await User.findOne({ _id: req.params.id, role: 'patient' });
  if (!u) throw ApiError.notFound('Patient not found.');
  u.isActive = req.body.isActive;
  await u.save();
  await audit({ req, user: req.user._id, action: u.isActive ? 'PATIENT_ACTIVATED' : 'PATIENT_DEACTIVATED', entity: 'User', entityId: u._id, description: `${u.firstName} ${u.lastName} (${u.email}) ${u.isActive ? 'reactivated' : 'deactivated'}` });
  res.json({ success: true, message: `${u.firstName} ${u.lastName}'s account is now ${u.isActive ? 'active' : 'inactive'}.`, data: { isActive: u.isActive } });
});

module.exports = { list, getOne, setStatus };

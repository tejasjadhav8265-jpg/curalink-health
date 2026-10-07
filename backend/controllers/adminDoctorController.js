const Doctor = require('../models/Doctor');
const Department = require('../models/Department');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { SLOT_HOLDING_STATUSES } = require('../utils/constants');
const { todayIST } = require('../utils/dates');
const { clampInt, escapeRegex } = require('../utils/text');
const { audit } = require('../services/auditService');

const cleanList = (list) => [...new Set((list || []).map((s) => String(s).trim()).filter(Boolean))];
const withDr = (name) => (/^dr\.?\s/i.test(name) ? name.replace(/^dr\.?\s*/i, 'Dr. ') : `Dr. ${name}`);
const splitName = (name) => {
  const parts = name.replace(/^dr\.?\s*/i, '').trim().split(/\s+/);
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
};

// Only fields an admin may set (never `user`, `ratingAvg` or other internals from the request).
const fieldsFrom = (b) => ({
  name: withDr(b.name.trim()), phone: b.phone, specialization: b.specialization, department: b.department,
  qualification: b.qualification || '', experience: b.experience, gender: b.gender || undefined,
  languages: cleanList(b.languages), registrationNumber: b.registrationNumber, location: b.location, branch: b.branch || '',
  consultationFee: b.consultationFee, about: b.about || '', conditionsTreated: cleanList(b.conditionsTreated), procedures: cleanList(b.procedures),
  consultationTypes: [...new Set(b.consultationTypes)], ...(b.profileImage ? { profileImage: b.profileImage } : {}),
});

const upcomingFor = async (ids) => {
  const rows = await Appointment.aggregate([
    { $match: { doctor: { $in: ids }, status: { $in: SLOT_HOLDING_STATUSES }, appointmentDate: { $gte: todayIST() } } },
    { $group: { _id: '$doctor', n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
};

// GET /api/admin/doctors?q=&status=&department=&page=
const list = asyncHandler(async (req, res) => {
  const page = clampInt(req.query.page, 1, 10000, 1);
  const limit = clampInt(req.query.limit, 1, 50, 10);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.department) filter.department = req.query.department;
  const q = String(req.query.q || '').trim().slice(0, 60);
  if (q) { const rx = new RegExp(escapeRegex(q), 'i'); filter.$or = [{ name: rx }, { specialization: rx }, { email: rx }, { registrationNumber: rx }]; }

  const [total, doctors] = await Promise.all([
    Doctor.countDocuments(filter),
    Doctor.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).populate('department', 'name').select('name email specialization department location consultationFee status experience registrationNumber user').lean(),
  ]);
  const upcoming = await upcomingFor(doctors.map((d) => d._id));
  res.json({
    success: true,
    data: {
      doctors: doctors.map((d) => ({ ...d, department: d.department ? d.department.name : '', hasLogin: Boolean(d.user), upcoming: upcoming.get(String(d._id)) || 0 })),
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    },
  });
});

// GET /api/admin/doctors/:id  (for the edit form)
const getOne = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findById(req.params.id).select('-__v').lean();
  if (!doctor) throw ApiError.notFound('Doctor not found.');
  res.json({ success: true, data: { doctor } });
});

// POST /api/admin/doctors  - creates the doctor profile AND their login account
const create = asyncHandler(async (req, res) => {
  const b = req.body;
  if (!(await Department.exists({ _id: b.department }))) throw ApiError.badRequest('Please choose a valid department.');
  const clash = await User.findOne({ $or: [{ email: b.email }, { phone: b.phone }] }).select('firstName lastName email phone role').lean();
  if (clash) {
    const what = clash.email === b.email ? `The email ${b.email}` : `The mobile number ${b.phone}`;
    throw ApiError.conflict(`${what} is already used by a ${clash.role} account (${clash.firstName} ${clash.lastName}, ${clash.email}). Use a different ${clash.email === b.email ? 'email' : 'mobile number'}, or find that account under ${clash.role === 'doctor' ? 'Doctors' : 'Patients'}.`);
  }
  if (await Doctor.exists({ email: b.email })) throw ApiError.conflict(`A doctor profile with the email ${b.email} already exists. Look for it under Doctors.`);
  if (await Doctor.exists({ registrationNumber: b.registrationNumber })) throw ApiError.conflict('Another doctor already uses this registration number.');

  const { firstName, lastName } = splitName(b.name);
  const user = await User.create({ firstName, lastName, email: b.email, phone: b.phone, gender: b.gender || undefined, role: 'doctor', passwordHash: await User.hashPassword(b.password) });
  let doctor;
  try {
    doctor = await Doctor.create({ ...fieldsFrom(b), email: b.email, user: user._id });
  } catch (err) {
    await User.deleteOne({ _id: user._id }); // do not leave a login without a profile
    throw err;
  }
  await audit({ req, user: req.user._id, action: 'DOCTOR_CREATED', entity: 'Doctor', entityId: doctor._id, description: `Admin created ${doctor.name} (${doctor.specialization})` });
  res.status(201).json({ success: true, message: `${doctor.name} was added. They can log in with the email and password you set, then set their timings.`, data: { doctor: { _id: doctor._id, name: doctor.name } } });
});

// PUT /api/admin/doctors/:id  (email stays the same; it is the doctor's login)
const update = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findById(req.params.id);
  if (!doctor) throw ApiError.notFound('Doctor not found.');
  if (!(await Department.exists({ _id: req.body.department }))) throw ApiError.badRequest('Please choose a valid department.');
  if (await Doctor.exists({ _id: { $ne: doctor._id }, registrationNumber: req.body.registrationNumber })) throw ApiError.conflict('Another doctor already uses this registration number.');

  doctor.set(fieldsFrom(req.body));
  await doctor.save();
  if (doctor.user) await User.updateOne({ _id: doctor.user }, { $set: splitName(doctor.name) }); // keep the login name in step
  await audit({ req, user: req.user._id, action: 'DOCTOR_UPDATED', entity: 'Doctor', entityId: doctor._id, description: `Admin updated ${doctor.name}` });
  res.json({ success: true, message: 'Doctor details saved.', data: { doctor: { _id: doctor._id, name: doctor.name } } });
});

// PATCH /api/admin/doctors/:id/status  { status: 'active' | 'inactive' }
// Inactive doctors disappear from search and cannot be booked. Existing appointments are kept.
const setStatus = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findById(req.params.id);
  if (!doctor) throw ApiError.notFound('Doctor not found.');
  doctor.status = req.body.status;
  await doctor.save();
  const upcoming = (await upcomingFor([doctor._id])).get(String(doctor._id)) || 0;
  await audit({ req, user: req.user._id, action: req.body.status === 'active' ? 'DOCTOR_ACTIVATED' : 'DOCTOR_DEACTIVATED', entity: 'Doctor', entityId: doctor._id, description: `${doctor.name} set to ${req.body.status}` });
  const warning = req.body.status === 'inactive' && upcoming ? `${upcoming} upcoming ${upcoming === 1 ? 'appointment is' : 'appointments are'} still booked with this doctor. They were kept.` : '';
  res.json({ success: true, message: `${doctor.name} is now ${req.body.status}.`, data: { status: doctor.status, warning } });
});

module.exports = { list, getOne, create, update, setStatus };

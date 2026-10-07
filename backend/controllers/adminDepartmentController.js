const Department = require('../models/Department');
const Doctor = require('../models/Doctor');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { audit } = require('../services/auditService');

const fields = (b) => ({ name: b.name, description: b.description || '', icon: b.icon || 'fa-stethoscope', ...(b.status ? { status: b.status } : {}) });

// GET /api/admin/departments  (all, including inactive)
const list = asyncHandler(async (req, res) => {
  const [departments, counts] = await Promise.all([
    Department.find().sort({ name: 1 }).select('-__v').lean(),
    Doctor.aggregate([{ $group: { _id: '$department', total: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } } } }]),
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c]));
  res.json({ success: true, data: { departments: departments.map((d) => ({ ...d, doctors: (byId.get(String(d._id)) || {}).total || 0, activeDoctors: (byId.get(String(d._id)) || {}).active || 0 })) } });
});

// POST /api/admin/departments
const create = asyncHandler(async (req, res) => {
  const d = await Department.create(fields(req.body)); // a duplicate name becomes a friendly 409
  await audit({ req, user: req.user._id, action: 'DEPARTMENT_CREATED', entity: 'Department', entityId: d._id, description: `Created ${d.name}` });
  res.status(201).json({ success: true, message: `${d.name} was added.`, data: { department: { _id: d._id, name: d.name } } });
});

// PUT /api/admin/departments/:id
const update = asyncHandler(async (req, res) => {
  const d = await Department.findById(req.params.id);
  if (!d) throw ApiError.notFound('Department not found.');
  d.set(fields(req.body));
  await d.save();
  await audit({ req, user: req.user._id, action: 'DEPARTMENT_UPDATED', entity: 'Department', entityId: d._id, description: `Updated ${d.name}` });
  res.json({ success: true, message: 'Department saved.', data: { department: { _id: d._id, name: d.name } } });
});

// DELETE /api/admin/departments/:id  (only when no doctor belongs to it)
const remove = asyncHandler(async (req, res) => {
  const d = await Department.findById(req.params.id);
  if (!d) throw ApiError.notFound('Department not found.');
  const doctors = await Doctor.countDocuments({ department: d._id });
  if (doctors) throw ApiError.conflict(`${d.name} still has ${doctors} ${doctors === 1 ? 'doctor' : 'doctors'}. Move them first, or mark the department inactive instead.`);
  await d.deleteOne();
  await audit({ req, user: req.user._id, action: 'DEPARTMENT_DELETED', entity: 'Department', entityId: d._id, description: `Deleted ${d.name}` });
  res.json({ success: true, message: `${d.name} was deleted.` });
});

module.exports = { list, create, update, remove };

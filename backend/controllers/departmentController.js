const mongoose = require('mongoose');
const Department = require('../models/Department');
const Doctor = require('../models/Doctor');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');

async function doctorCounts() {
  const rows = await Doctor.aggregate([
    { $match: { status: 'active' } },
    { $group: { _id: '$department', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

// GET /api/departments
const list = asyncHandler(async (req, res) => {
  const [departments, counts] = await Promise.all([
    Department.find({ status: 'active' }).sort({ name: 1 }).select('-__v').lean(),
    doctorCounts(),
  ]);
  const data = departments.map((d) => ({ ...d, doctorCount: counts.get(String(d._id)) || 0 }));
  res.json({ success: true, data: { departments: data } });
});

// GET /api/departments/:idOrSlug   (e.g. /api/departments/cardiology)
const getOne = asyncHandler(async (req, res) => {
  const key = req.params.idOrSlug;
  const query = mongoose.isValidObjectId(key) ? { _id: key } : { slug: String(key).toLowerCase() };
  const department = await Department.findOne({ ...query, status: 'active' }).select('-__v').lean();
  if (!department) throw ApiError.notFound('Department not found.');
  const doctorCount = await Doctor.countDocuments({ department: department._id, status: 'active' });
  res.json({ success: true, data: { department: { ...department, doctorCount } } });
});

module.exports = { list, getOne };

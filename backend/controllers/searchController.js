const DoctorSearch = require('../models/DoctorSearch');
const asyncHandler = require('../utils/asyncHandler');

// Only these filter names are stored, each as a short plain value (nothing else can be injected).
const FILTER_KEYS = ['department', 'branch', 'gender', 'minExperience', 'maxFee', 'availableOn', 'consultationType', 'language', 'minRating', 'sort'];

function cleanFilters(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  FILTER_KEYS.forEach((key) => {
    const value = input[key];
    if ((typeof value === 'string' || typeof value === 'number') && String(value) !== '') {
      out[key] = String(value).slice(0, 50);
    }
  });
  return out;
}

// POST /api/searches - remember what was searched (works for guests and logged-in users)
const record = asyncHandler(async (req, res) => {
  const { keyword, specialization, location, filters, resultsCount } = req.body;
  const search = await DoctorSearch.create({
    user: req.user ? req.user._id : undefined,
    keyword: keyword || undefined,
    specialization: specialization || undefined,
    location: location || undefined,
    filters: cleanFilters(filters),
    resultsCount: Number.isInteger(resultsCount) ? resultsCount : 0,
  });
  res.status(201).json({ success: true, data: { searchId: search._id } });
});

// PATCH /api/searches/:id/click - which doctor was opened from this search
const markClick = asyncHandler(async (req, res) => {
  await DoctorSearch.updateOne(
    { _id: req.params.id, clickedDoctor: { $exists: false } },
    { $set: { clickedDoctor: req.body.doctorId } }
  );
  res.json({ success: true });
});

// GET /api/searches - admins see everyone's recent searches, everyone else only their own
const list = asyncHandler(async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { user: req.user._id };
  const searches = await DoctorSearch.find(filter).sort({ createdAt: -1 }).limit(100)
    .populate('clickedDoctor', 'name specialization').select('-__v').lean();
  res.json({ success: true, data: { searches } });
});

module.exports = { record, markClick, list };

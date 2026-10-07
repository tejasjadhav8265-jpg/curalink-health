const mongoose = require('mongoose');
const Doctor = require('../models/Doctor');
const Department = require('../models/Department');
const DoctorAvailability = require('../models/DoctorAvailability');
const Feedback = require('../models/Feedback');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { escapeRegex } = require('../utils/text');
const { todayIST, nowTimeIST, addDays, weekdayName } = require('../utils/dates');
const { isAvailableOn, workingDays } = require('../services/availabilityRules');
const { parseDoctorQuery, tokenize, resolveAvailability, buildFilter } = require('../services/doctorQuery');

// Private fields (email, phone, login link) are never sent to the public.
const LIST_FIELDS = '-email -phone -user -registrationNumber -about -__v -createdAt -updatedAt';
const DETAIL_FIELDS = '-email -phone -user -__v';

// Ids of doctors who work on `date` (and, for today, still have hours left).
async function doctorIdsAvailableOn(date, checkTime) {
  const day = weekdayName(date);
  const docs = await DoctorAvailability.find({
    [`weekly.${day}.0`]: { $exists: true },
    blockedDates: { $ne: date },
  }).select('doctor weekly blockedDates').lean();
  const now = checkTime ? nowTimeIST() : null;
  return docs.filter((d) => isAvailableOn(d, date, now)).map((d) => d.doctor);
}

// Adds { today, tomorrow, days } to each doctor so cards can show an availability badge.
async function attachAvailability(doctors) {
  if (!doctors.length) return doctors;
  const rows = await DoctorAvailability.find({ doctor: { $in: doctors.map((d) => d._id) } })
    .select('doctor weekly blockedDates').lean();
  const byDoctor = new Map(rows.map((r) => [String(r.doctor), r]));
  const today = todayIST();
  const tomorrow = addDays(today, 1);
  const now = nowTimeIST();
  doctors.forEach((doc) => {
    const avail = byDoctor.get(String(doc._id));
    doc.availability = {
      today: isAvailableOn(avail, today, now),
      tomorrow: isAvailableOn(avail, tomorrow),
      days: workingDays(avail),
    };
  });
  return doctors;
}

// GET /api/doctors?q=&department=&location=&gender=&minExperience=&maxFee=&availableOn=&sort=&page=
const list = asyncHandler(async (req, res) => {
  const params = parseDoctorQuery(req.query);
  const departments = await Department.find({ status: 'active' }).select('name slug').lean(); // small table

  // Search words that match a department name (so "cardiology" finds Cardiology doctors).
  const deptIdsByToken = tokenize(params.q).map((token) => {
    const re = new RegExp(escapeRegex(token), 'i');
    return departments.filter((d) => re.test(d.name)).map((d) => d._id);
  });

  let departmentId;
  if (params.department) {
    const wanted = params.department.toLowerCase();
    const match = departments.find((d) => d.slug === wanted || String(d._id) === params.department);
    departmentId = match ? match._id : null;
  }

  let availableIds;
  const availability = resolveAvailability(params.availableOn);
  if (availability) {
    availableIds = availability.none ? [] : await doctorIdsAvailableOn(availability.date, availability.checkTime);
  }

  const { filter, sort } = buildFilter(params, { deptIdsByToken, departmentId, availableIds });
  const [total, doctors] = await Promise.all([
    Doctor.countDocuments(filter),
    Doctor.find(filter).sort(sort).skip((params.page - 1) * params.limit).limit(params.limit)
      .select(LIST_FIELDS).populate('department', 'name slug').lean(),
  ]);
  await attachAvailability(doctors);

  res.json({
    success: true,
    data: {
      doctors,
      pagination: { page: params.page, limit: params.limit, total, pages: Math.max(1, Math.ceil(total / params.limit)) },
    },
  });
});

// GET /api/doctors/facets - the choices that fill the filter drop-downs
const facets = asyncHandler(async (req, res) => {
  const active = { status: 'active' };
  const [locations, branches, specializations, languages, fees, departments] = await Promise.all([
    Doctor.distinct('location', active),
    Doctor.distinct('branch', active),
    Doctor.distinct('specialization', active),
    Doctor.distinct('languages', active),
    Doctor.aggregate([{ $match: active }, { $group: { _id: null, min: { $min: '$consultationFee' }, max: { $max: '$consultationFee' } } }]),
    Department.find({ status: 'active' }).sort({ name: 1 }).select('name slug').lean(),
  ]);
  const sorted = (arr) => arr.filter(Boolean).sort((a, b) => a.localeCompare(b));
  res.json({
    success: true,
    data: {
      locations: sorted(locations),
      branches: sorted(branches),
      specializations: sorted(specializations),
      languages: sorted(languages),
      fee: fees[0] ? { min: fees[0].min, max: fees[0].max } : { min: 0, max: 0 },
      departments,
    },
  });
});

// GET /api/doctors/:id - full public profile
const getOne = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('Doctor not found.');

  const doctor = await Doctor.findOne({ _id: id, status: 'active' })
    .select(DETAIL_FIELDS).populate('department', 'name slug icon').lean();
  if (!doctor) throw ApiError.notFound('Doctor not found.');

  const [avail, feedbacks] = await Promise.all([
    DoctorAvailability.findOne({ doctor: id }).select('slotDuration weekly blockedDates').lean(),
    Feedback.find({ doctor: id, status: 'visible' }).sort({ createdAt: -1 }).limit(10)
      .populate('patient', 'firstName lastName').lean(),
  ]);

  const today = todayIST();
  doctor.availability = {
    today: isAvailableOn(avail, today, nowTimeIST()),
    tomorrow: isAvailableOn(avail, addDays(today, 1)),
    days: workingDays(avail),
  };

  res.json({
    success: true,
    data: {
      doctor,
      schedule: avail
        ? { slotDuration: avail.slotDuration, weekly: avail.weekly, blockedDates: (avail.blockedDates || []).filter((d) => d >= today) }
        : null,
      // Reviews show first name + last initial only (privacy).
      reviews: feedbacks.map((f) => ({
        name: f.patient ? `${f.patient.firstName} ${(f.patient.lastName || '').charAt(0)}.` : 'Patient',
        doctorRating: f.doctorRating,
        hospitalRating: f.hospitalRating,
        staffRating: f.staffRating,
        comment: f.comment,
        date: f.createdAt,
        verified: f.verified,
      })),
    },
  });
});

module.exports = { list, facets, getOne };

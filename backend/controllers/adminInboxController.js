const ContactMessage = require('../models/ContactMessage');
const EmergencyRequest = require('../models/EmergencyRequest');
const Insurance = require('../models/Insurance');
const PackageBooking = require('../models/PackageBooking');
const Feedback = require('../models/Feedback');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { clampInt } = require('../utils/text');
const { notify } = require('../services/notificationService');
const { audit } = require('../services/auditService');
const { applyRating } = require('./feedbackController');
const { mask } = require('./insuranceController');

const name = (u) => (u ? `${u.firstName} ${u.lastName}` : 'Unknown');

// One table describes every list the admin works through: where it lives, what statuses it has and how a row looks.
const KINDS = {
  contact: {
    Model: ContactMessage, statuses: ['new', 'read', 'resolved'], pending: 'new',
    populate: [], row: (c) => ({ title: c.subject, from: c.name, email: c.email, phone: c.phone || '', body: c.message }),
  },
  emergency: {
    Model: EmergencyRequest, statuses: ['new', 'dispatched', 'completed', 'cancelled'], pending: 'new',
    populate: [], row: (e) => ({ title: `${e.emergencyType} (${e.patientCount} ${e.patientCount === 1 ? 'patient' : 'patients'})`, from: e.patientName, phone: e.phone, body: `Pickup: ${e.pickupLocation}${e.additionalInfo ? `. Note: ${e.additionalInfo}` : ''}`, reference: `AMB-${String(e._id).slice(-6).toUpperCase()}` }),
  },
  insurance: {
    Model: Insurance, statuses: ['submitted', 'verified', 'rejected'], pending: 'submitted',
    populate: [['patient', 'firstName lastName email phone']], row: (i) => ({ title: i.provider, from: name(i.patient), email: i.patient ? i.patient.email : '', phone: i.patient ? i.patient.phone : '', body: `Policy ${mask(i.policyNumber)}${i.patientIdRef ? `, member ID ${i.patientIdRef}` : ''}` }),
  },
  packages: {
    Model: PackageBooking, statuses: ['pending', 'confirmed', 'completed', 'cancelled'], pending: 'pending',
    populate: [['patient', 'firstName lastName email phone'], ['package', 'name price']], row: (b) => ({ title: b.package ? b.package.name : 'Package', from: name(b.patient), email: b.patient ? b.patient.email : '', phone: b.patient ? b.patient.phone : '', body: `Preferred date ${b.preferredDate}` }),
  },
  feedback: {
    Model: Feedback, statuses: ['visible', 'hidden'], pending: null,
    populate: [['patient', 'firstName lastName'], ['doctor', 'name']], row: (f) => ({ title: `${f.doctor ? f.doctor.name : 'Doctor'}: doctor ${f.doctorRating}/5, hospital ${f.hospitalRating}/5, staff ${f.staffRating}/5`, from: name(f.patient), body: f.comment || '(no comment)' }),
  },
};

// GET /api/admin/inbox  -> how many items are waiting in each list
const counts = asyncHandler(async (req, res) => {
  const entries = await Promise.all(Object.entries(KINDS).map(async ([kind, k]) => [kind, k.pending ? await k.Model.countDocuments({ status: k.pending }) : 0]));
  res.json({ success: true, data: { counts: Object.fromEntries(entries) } });
});

// GET /api/admin/inbox/:kind?status=&page=
const list = asyncHandler(async (req, res) => {
  const k = KINDS[req.params.kind];
  const page = clampInt(req.query.page, 1, 10000, 1);
  const limit = clampInt(req.query.limit, 1, 50, 10);
  const filter = {};
  if (req.query.status) { if (!k.statuses.includes(req.query.status)) throw ApiError.badRequest('Unknown status.'); filter.status = req.query.status; }
  let query = k.Model.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
  k.populate.forEach(([path, select]) => { query = query.populate(path, select); });
  const [total, docs] = await Promise.all([k.Model.countDocuments(filter), query.lean()]);
  res.json({ success: true, data: { statuses: k.statuses, items: docs.map((d) => ({ _id: d._id, status: d.status, createdAt: d.createdAt, ...k.row(d) })), pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } } });
});

// PATCH /api/admin/inbox/:kind/:id  { status }
const setStatus = asyncHandler(async (req, res) => {
  const k = KINDS[req.params.kind];
  const status = req.body.status;
  if (!k.statuses.includes(status)) throw ApiError.badRequest('Please choose a valid status.');
  const doc = await k.Model.findById(req.params.id);
  if (!doc) throw ApiError.notFound('Not found.');
  const before = doc.status;
  if (before === status) return res.json({ success: true, message: 'No change.' });
  doc.status = status;
  await doc.save();

  if (req.params.kind === 'feedback') { // hiding takes the rating out of the doctor's average, showing puts it back
    await applyRating(doc.doctor, doc.doctorRating, status === 'hidden' ? -1 : +1);
  }
  if (req.params.kind === 'insurance') {
    await notify(doc.patient, { type: 'general', title: `Insurance policy ${status}`, message: `Your ${doc.provider} policy was marked ${status}.`, link: '/pages/public/insurance.html' });
  }
  if (req.params.kind === 'packages' && ['confirmed', 'cancelled'].includes(status)) {
    await notify(doc.patient, { type: 'general', title: `Health package ${status}`, message: `Your health package request for ${doc.preferredDate} was ${status}.`, link: '/pages/public/health-packages.html' });
  }
  await audit({ req, user: req.user._id, action: `INBOX_${req.params.kind.toUpperCase()}_${status.toUpperCase().replace(/-/g, '_')}`, entity: k.Model.modelName, entityId: doc._id, description: `${req.params.kind}: ${before} to ${status}` });
  res.json({ success: true, message: 'Status updated.' });
});

module.exports = { counts, list, setStatus, KINDS };

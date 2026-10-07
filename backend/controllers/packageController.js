const HealthPackage = require('../models/HealthPackage');
const PackageBooking = require('../models/PackageBooking');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { notify } = require('../services/notificationService');
const { audit } = require('../services/auditService');

const OPEN = ['pending', 'confirmed'];

// GET /api/packages  (public)
const list = asyncHandler(async (req, res) => {
  const packages = await HealthPackage.find({ status: 'active' }).sort({ price: 1 }).select('name description tests price duration').lean();
  res.json({ success: true, data: { packages } });
});

// POST /api/packages/:id/book  { preferredDate }   (patient)
const book = asyncHandler(async (req, res) => {
  const pkg = await HealthPackage.findOne({ _id: req.params.id, status: 'active' });
  if (!pkg) throw ApiError.notFound('This package is not available.');
  const already = await PackageBooking.findOne({ patient: req.user._id, package: pkg._id, preferredDate: req.body.preferredDate, status: { $in: OPEN } });
  if (already) throw ApiError.conflict('You already requested this package for that date.');
  if ((await PackageBooking.countDocuments({ patient: req.user._id, status: { $in: OPEN } })) >= 5) throw ApiError.conflict('You have 5 open package requests. Please cancel one before adding another.');

  const booking = await PackageBooking.create({ patient: req.user._id, package: pkg._id, preferredDate: req.body.preferredDate });
  await notify(req.user._id, { type: 'general', title: 'Health package requested', message: `${pkg.name} on ${req.body.preferredDate}. The hospital will confirm your slot. Payment is collected at the hospital (demo).`, link: '/pages/public/health-packages.html' });
  res.status(201).json({ success: true, message: `${pkg.name} was requested for ${req.body.preferredDate}. We will confirm the time.`, data: { booking: { _id: booking._id } } });
});

// GET /api/packages/mine  (patient)
const mine = asyncHandler(async (req, res) => {
  const bookings = await PackageBooking.find({ patient: req.user._id }).sort({ createdAt: -1 }).limit(30).populate('package', 'name price duration').lean();
  res.json({ success: true, data: { bookings: bookings.map((b) => ({ _id: b._id, name: b.package ? b.package.name : 'Package', price: b.package ? b.package.price : 0, duration: b.package ? b.package.duration : '', preferredDate: b.preferredDate, status: b.status, paymentStatus: b.paymentStatus })) } });
});

// PATCH /api/packages/bookings/:id/cancel  (patient)
const cancel = asyncHandler(async (req, res) => {
  const booking = await PackageBooking.findOne({ _id: req.params.id, patient: req.user._id });
  if (!booking) throw ApiError.notFound('Request not found.');
  if (!OPEN.includes(booking.status)) throw ApiError.badRequest('This request can no longer be cancelled.');
  booking.status = 'cancelled';
  await booking.save();
  await audit({ req, user: req.user._id, action: 'PACKAGE_CANCELLED', entity: 'PackageBooking', entityId: booking._id, description: 'Patient cancelled a health package request' });
  res.json({ success: true, message: 'Your request was cancelled.' });
});

module.exports = { list, book, mine, cancel };

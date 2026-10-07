const Insurance = require('../models/Insurance');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { audit } = require('../services/auditService');
const { INSURERS } = require('../validators/extraValidators');

// The full policy number is never sent back to the browser, only the last 4 characters.
const mask = (n) => (n.length <= 4 ? n : `${'*'.repeat(Math.min(8, n.length - 4))}${n.slice(-4)}`);

// GET /api/insurance/providers  (public)
const providers = (req, res) => res.json({ success: true, data: { providers: INSURERS } });

// POST /api/insurance  (patient)
const submit = asyncHandler(async (req, res) => {
  if ((await Insurance.countDocuments({ patient: req.user._id })) >= 5) throw ApiError.conflict('You can keep up to 5 policies. Please contact us to remove an old one.');
  const policyNumber = req.body.policyNumber.trim();
  if (await Insurance.exists({ patient: req.user._id, provider: req.body.provider, policyNumber })) throw ApiError.conflict('You already submitted this policy.');
  const doc = await Insurance.create({ patient: req.user._id, provider: req.body.provider, policyNumber, patientIdRef: req.body.patientIdRef || undefined });
  await audit({ req, user: req.user._id, action: 'INSURANCE_SUBMITTED', entity: 'Insurance', entityId: doc._id, description: `Policy submitted (${req.body.provider})` });
  res.status(201).json({ success: true, message: 'Your policy was submitted. The hospital desk will check it and update the status here.' });
});

// GET /api/insurance/mine  (patient)
const mine = asyncHandler(async (req, res) => {
  const items = await Insurance.find({ patient: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: { policies: items.map((i) => ({ _id: i._id, provider: i.provider, policyNumber: mask(i.policyNumber), patientIdRef: i.patientIdRef || '', status: i.status, createdAt: i.createdAt })) } });
});

module.exports = { providers, submit, mine, mask };

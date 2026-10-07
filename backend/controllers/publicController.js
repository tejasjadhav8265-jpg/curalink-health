const ContactMessage = require('../models/ContactMessage');
const EmergencyRequest = require('../models/EmergencyRequest');
const Article = require('../models/Article');
const Department = require('../models/Department');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { clampInt, escapeRegex } = require('../utils/text');
const { analyse } = require('../services/specialtyRules');
const { ARTICLE_CATEGORIES } = require('../utils/constants');
const { EMERGENCY_TYPES, INSURERS } = require('../validators/extraValidators');

// POST /api/contact
const contact = asyncHandler(async (req, res) => {
  const { name, email, phone, subject, message } = req.body;
  await ContactMessage.create({ name, email, phone: phone || undefined, subject, message });
  res.status(201).json({ success: true, message: 'Thank you. Your message was sent and our team will reply by email.' });
});

// POST /api/emergency  (no login needed). This is a DEMO request: nobody is really dispatched.
const emergency = asyncHandler(async (req, res) => {
  const b = req.body;
  const request = await EmergencyRequest.create({
    user: req.user ? req.user._id : undefined, patientName: b.patientName, phone: b.phone, pickupLocation: b.pickupLocation,
    emergencyType: b.emergencyType, patientCount: b.patientCount || 1, additionalInfo: b.additionalInfo || undefined,
  });
  res.status(201).json({ success: true, message: 'Your request was recorded. This is a demo website, so no ambulance is sent. In a real emergency call 108 or 112 now.', data: { reference: `AMB-${String(request._id).slice(-6).toUpperCase()}` } });
});

// GET /api/meta  - lists used by forms (emergency types, insurers, article categories)
const meta = (req, res) => res.json({ success: true, data: { emergencyTypes: EMERGENCY_TYPES, insurers: INSURERS, articleCategories: ARTICLE_CATEGORIES } });

// GET /api/articles?category=&q=&page=
const articles = asyncHandler(async (req, res) => {
  const page = clampInt(req.query.page, 1, 10000, 1);
  const limit = clampInt(req.query.limit, 1, 24, 9);
  const filter = { status: 'published' };
  if (req.query.category) filter.category = req.query.category;
  const q = String(req.query.q || '').trim().slice(0, 60);
  if (q) { const rx = new RegExp(escapeRegex(q), 'i'); filter.$or = [{ title: rx }, { content: rx }]; }
  const [total, items] = await Promise.all([
    Article.countDocuments(filter),
    Article.find(filter).sort({ publishedAt: -1 }).skip((page - 1) * limit).limit(limit).select('title slug image category author publishedAt content').lean(),
  ]);
  res.json({ success: true, data: { articles: items.map(({ content, ...a }) => ({ ...a, summary: content.replace(/\s+/g, ' ').slice(0, 170) + (content.length > 170 ? '...' : '') })), pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } } });
});

// GET /api/articles/:slug
const article = asyncHandler(async (req, res) => {
  const a = await Article.findOne({ slug: String(req.params.slug).toLowerCase().slice(0, 150), status: 'published' }).select('-__v').lean();
  if (!a) throw ApiError.notFound('Article not found.');
  const related = await Article.find({ status: 'published', category: a.category, _id: { $ne: a._id } }).sort({ publishedAt: -1 }).limit(3).select('title slug category').lean();
  res.json({ success: true, data: { article: a, related } });
});

// GET /api/specialty-finder?text=...
const specialtyFinder = asyncHandler(async (req, res) => {
  const result = analyse(req.query.text);
  const names = result.suggestions.map((s) => s.department);
  const depts = await Department.find({ name: { $in: names }, status: 'active' }).select('name slug').lean();
  const bySlug = new Map(depts.map((d) => [d.name, d.slug]));
  res.json({ success: true, data: { redFlags: result.redFlags, fallback: result.fallback, suggestions: result.suggestions.map((s) => ({ ...s, slug: bySlug.get(s.department) || '' })) } });
});

module.exports = { contact, emergency, meta, articles, article, specialtyFinder };

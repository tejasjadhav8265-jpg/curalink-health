const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { clampInt } = require('../utils/text');

// GET /api/notifications?unread=1&page=1&limit=15
const list = asyncHandler(async (req, res) => {
  const filter = { user: req.user._id };
  if (req.query.unread === '1') filter.isRead = false;
  const page = clampInt(req.query.page, 1, 10000, 1);
  const limit = clampInt(req.query.limit, 1, 50, 15);
  const [total, items, unread] = await Promise.all([
    Notification.countDocuments(filter),
    Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select('-__v').lean(),
    Notification.countDocuments({ user: req.user._id, isRead: false }),
  ]);
  res.json({ success: true, data: { notifications: items, unreadCount: unread, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } } });
});

// GET /api/notifications/unread-count  (the bell in the menu bar)
const unreadCount = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { unreadCount: await Notification.countDocuments({ user: req.user._id, isRead: false }) } });
});

// PATCH /api/notifications/read-all  (declared before '/:id/read' in the routes)
const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, isRead: false }, { $set: { isRead: true } });
  res.json({ success: true, message: 'All notifications marked as read.', data: { unreadCount: 0 } });
});

// PATCH /api/notifications/:id/read
const markRead = asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { $set: { isRead: true } }, { new: true }).lean();
  if (!n) throw ApiError.notFound('Notification not found.');
  res.json({ success: true, data: { notification: n, unreadCount: await Notification.countDocuments({ user: req.user._id, isRead: false }) } });
});

// DELETE /api/notifications/:id
const remove = asyncHandler(async (req, res) => {
  const result = await Notification.deleteOne({ _id: req.params.id, user: req.user._id });
  if (!result.deletedCount) throw ApiError.notFound('Notification not found.');
  res.json({ success: true, message: 'Notification removed.', data: { unreadCount: await Notification.countDocuments({ user: req.user._id, isRead: false }) } });
});

module.exports = { list, unreadCount, markAllRead, markRead, remove };

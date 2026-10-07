const ApiError = require('../utils/apiError');

// Must run AFTER authenticateUser.
const requireRoles = (...roles) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
  next();
};

module.exports = {
  requireRoles,
  requirePatient: requireRoles('patient'),
  requireDoctor: requireRoles('doctor'),
  requireAdmin: requireRoles('admin'),
  requireStaff: requireRoles('doctor', 'admin'),
};

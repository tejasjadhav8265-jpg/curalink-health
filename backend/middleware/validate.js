const { validationResult } = require('express-validator');
const ApiError = require('../utils/apiError');

// Place after express-validator chains. Converts failures into one friendly 400.
module.exports = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const details = result.array().map((e) => ({ field: e.path, message: e.msg }));
  next(ApiError.badRequest(details[0].message, details));
};

const { body, param } = require('express-validator');

const optionalText = (field, max = 100) =>
  body(field).optional({ values: 'falsy' }).isString().withMessage(`Invalid ${field}.`).bail()
    .isLength({ max }).withMessage(`${field} is too long.`);

const recordSearchRules = [
  optionalText('keyword'),
  optionalText('specialization'),
  optionalText('location'),
  body('filters').optional().isObject().withMessage('Invalid filters.'),
  body('resultsCount').optional().isInt({ min: 0, max: 100000 }).withMessage('Invalid results count.').toInt(),
];

const clickRules = [
  param('id').isMongoId().withMessage('Invalid search id.'),
  body('doctorId').isMongoId().withMessage('Invalid doctor id.'),
];

module.exports = { recordSearchRules, clickRules };

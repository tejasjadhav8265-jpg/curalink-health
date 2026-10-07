const { body, param } = require('express-validator');
const { CONSULTATION_TYPES, TIME_REGEX } = require('../utils/constants');
const { isValidDateString } = require('../utils/dates');

const idParam = param('id').isMongoId().withMessage('Invalid appointment id.');

const dateRule = body('date')
  .isString().withMessage('Please select an appointment date.').bail()
  .custom((v) => isValidDateString(v)).withMessage('Please select a valid appointment date.');

const timeRule = body('time')
  .isString().withMessage('Please select an appointment time.').bail()
  .matches(TIME_REGEX).withMessage('Please select a valid appointment time.');

const reasonRule = body('reason').optional({ values: 'falsy' })
  .isString().withMessage('Invalid reason.').bail()
  .isLength({ max: 500 }).withMessage('The reason is too long (maximum 500 characters).');

const createRules = [
  body('doctorId').isMongoId().withMessage('Please choose a doctor.'),
  dateRule,
  timeRule,
  body('consultationType').optional().isIn(CONSULTATION_TYPES).withMessage('Please select a consultation type.'),
  reasonRule,
];

const rescheduleRules = [idParam, dateRule, timeRule, reasonRule];

const cancelRules = [
  idParam,
  body('reason')
    .isString().withMessage('Please tell us why you are cancelling.').bail()
    .trim().isLength({ min: 3, max: 300 }).withMessage('Please tell us why you are cancelling (3 to 300 characters).'),
];

const slotsRules = [
  param('id').isMongoId().withMessage('Doctor not found.'),
];

module.exports = { idParam, createRules, rescheduleRules, cancelRules, slotsRules };

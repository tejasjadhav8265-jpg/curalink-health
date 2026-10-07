const { body, param } = require('express-validator');
const { SLOT_DURATIONS } = require('../utils/constants');
const { isValidDateString } = require('../utils/dates');
const { validateWeekly } = require('./weeklySchedule');

const saveRules = [
  body('slotDuration').isInt().withMessage('Please choose how long each visit lasts.').bail()
    .toInt().isIn(SLOT_DURATIONS).withMessage(`Visit length must be one of ${SLOT_DURATIONS.join(', ')} minutes.`),
  body('weekly').custom((value, { req }) => {
    const result = validateWeekly(value, req.body.slotDuration);
    if (result.error) throw new Error(result.error);
    req.body.weekly = result.weekly; // replace with the cleaned version
    return true;
  }),
];

const blockRules = [
  body('date').isString().withMessage('Please select a date.').bail()
    .custom((v) => isValidDateString(v)).withMessage('Please select a valid date.'),
];

const unblockRules = [
  param('date').custom((v) => isValidDateString(v)).withMessage('Please select a valid date.'),
];

module.exports = { saveRules, blockRules, unblockRules };

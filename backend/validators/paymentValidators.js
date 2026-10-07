const { body } = require('express-validator');

const demoPayRules = [
  body('appointmentId').isMongoId().withMessage('Please choose an appointment to pay for.'),
  body('outcome').optional().isIn(['paid', 'failed']).withMessage('Invalid payment outcome.'),
];

module.exports = { demoPayRules };

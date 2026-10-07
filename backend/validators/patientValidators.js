const { body, param } = require('express-validator');
const { GENDERS, INDIAN_MOBILE_REGEX } = require('../utils/constants');

const text = (field, msg, max = 80) =>
  body(field).isString().withMessage(msg).bail().trim().notEmpty().withMessage(msg).bail()
    .isLength({ max }).withMessage(`That is too long (maximum ${max} characters).`);

const profileRules = [
  text('firstName', 'Please enter your first name.', 50),
  text('lastName', 'Please enter your last name.', 50),
  body('phone').isString().withMessage('Please enter your mobile number.').bail().trim()
    .matches(INDIAN_MOBILE_REGEX).withMessage('Please enter a valid mobile number.'),
  body('dob').isString().withMessage('Please enter your date of birth.').bail().notEmpty().withMessage('Please enter your date of birth.').bail()
    .custom((v) => {
      const d = new Date(v);
      const now = new Date();
      if (Number.isNaN(d.getTime())) throw new Error('Please enter a valid date of birth.');
      if (d > now) throw new Error('Date of birth cannot be in the future.');
      if (now.getFullYear() - d.getFullYear() > 120) throw new Error('Please enter a valid date of birth.');
      return true;
    }),
  body('gender').isIn(GENDERS).withMessage('Please select your gender.'),
  body('address').optional({ values: 'falsy' }).isString().trim().isLength({ max: 300 }).withMessage('Address is too long (maximum 300 characters).'),
  text('city', 'Please enter your city.'),
  text('state', 'Please select your state.'),
  body('emergencyContact').optional({ values: 'falsy' }).isString().bail().trim()
    .matches(INDIAN_MOBILE_REGEX).withMessage('Please enter a valid emergency contact number.'),
];

const passwordRules = [
  body('currentPassword').isString().withMessage('Please enter your current password.').bail().notEmpty().withMessage('Please enter your current password.'),
  body('newPassword')
    .isString().withMessage('Please enter a new password.').bail()
    .isLength({ min: 8 }).withMessage('Password must contain at least 8 characters.').bail()
    .isLength({ max: 72 }).withMessage('Password must be 72 characters or fewer.').bail()
    .matches(/[a-z]/).withMessage('Password must include a lowercase letter.').bail()
    .matches(/[A-Z]/).withMessage('Password must include an uppercase letter.').bail()
    .matches(/\d/).withMessage('Password must include a number.').bail()
    .custom((v, { req }) => v !== req.body.currentPassword).withMessage('Your new password must be different from the current one.'),
];

const listRule = (field, label) => [
  body(field).optional().isArray({ max: 20 }).withMessage(`${label}: please list at most 20 items.`),
  body(`${field}.*`).optional().isString().trim().isLength({ min: 1, max: 60 }).withMessage(`${label}: each item can be up to 60 characters.`),
];

const recordRules = [
  body('bloodGroup').optional().isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', '']).withMessage('Please choose a valid blood group.'),
  ...listRule('allergies', 'Allergies'),
  ...listRule('chronicConditions', 'Ongoing conditions'),
  body('notes').optional({ values: 'falsy' }).isString().trim().isLength({ max: 2000 }).withMessage('Notes are too long (maximum 2000 characters).'),
];

const idParam = param('id').isMongoId().withMessage('Invalid identifier.');

module.exports = { profileRules, passwordRules, recordRules, idParam };

const { body } = require('express-validator');
const { GENDERS, INDIAN_MOBILE_REGEX } = require('../utils/constants');

// A required text field. isString() first so objects/arrays sent in JSON are rejected.
const requiredText = (field, requiredMsg, max = 80) =>
  body(field)
    .isString().withMessage(requiredMsg).bail()
    .trim().notEmpty().withMessage(requiredMsg).bail()
    .isLength({ max }).withMessage(`That is too long (maximum ${max} characters).`);

const emailRule = body('email')
  .isString().withMessage('Please enter your email.').bail()
  .trim().notEmpty().withMessage('Please enter your email.').bail()
  .isEmail().withMessage('Please enter a valid email address.').bail()
  .isLength({ max: 254 }).withMessage('That email is too long.')
  .toLowerCase();

const registerRules = [
  requiredText('firstName', 'Please enter your first name.', 50),
  requiredText('lastName', 'Please enter your last name.', 50),

  body('dob')
    .isString().withMessage('Please enter your date of birth.').bail()
    .notEmpty().withMessage('Please enter your date of birth.').bail()
    .custom((value) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) throw new Error('Please enter a valid date of birth.');
      const now = new Date();
      if (date > now) throw new Error('Date of birth cannot be in the future.');
      if (now.getFullYear() - date.getFullYear() > 120) throw new Error('Please enter a valid date of birth.');
      return true;
    }),

  body('gender').isIn(GENDERS).withMessage('Please select your gender.'),

  body('phone')
    .isString().withMessage('Please enter your mobile number.').bail()
    .trim().notEmpty().withMessage('Please enter your mobile number.').bail()
    .matches(INDIAN_MOBILE_REGEX).withMessage('Please enter a valid mobile number.'),

  emailRule,

  body('address').optional({ values: 'falsy' }).isString().trim()
    .isLength({ max: 300 }).withMessage('Address is too long (maximum 300 characters).'),
  requiredText('city', 'Please enter your city.'),
  requiredText('state', 'Please select your state.'),

  body('emergencyContact').optional({ values: 'falsy' })
    .isString().bail().trim()
    .matches(INDIAN_MOBILE_REGEX).withMessage('Please enter a valid emergency contact number.'),

  body('password')
    .isString().withMessage('Please enter a password.').bail()
    .notEmpty().withMessage('Please enter a password.').bail()
    .isLength({ min: 8 }).withMessage('Password must contain at least 8 characters.').bail()
    .isLength({ max: 72 }).withMessage('Password must be 72 characters or fewer.').bail()
    .matches(/[a-z]/).withMessage('Password must include a lowercase letter.').bail()
    .matches(/[A-Z]/).withMessage('Password must include an uppercase letter.').bail()
    .matches(/\d/).withMessage('Password must include a number.'),

  body('confirmPassword')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match.'),
];

const loginRules = [
  body('email')
    .isString().withMessage('Please enter your email.').bail()
    .trim().notEmpty().withMessage('Please enter your email.').bail()
    .isEmail().withMessage('Please enter a valid email address.')
    .toLowerCase(),
  body('password')
    .isString().withMessage('Please enter your password.').bail()
    .notEmpty().withMessage('Please enter your password.'),
];

module.exports = { registerRules, loginRules };

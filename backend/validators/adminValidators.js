const { body, param, query } = require('express-validator');
const { GENDERS, INDIAN_MOBILE_REGEX, CONSULTATION_TYPES, APPOINTMENT_STATUSES } = require('../utils/constants');
const { isValidDateString } = require('../utils/dates');

const idParam = param('id').isMongoId().withMessage('Invalid identifier.');
const text = (field, msg, max) => body(field).isString().withMessage(msg).bail().trim().notEmpty().withMessage(msg).bail().isLength({ max }).withMessage(`That is too long (maximum ${max} characters).`);
const optText = (field, max) => body(field).optional({ values: 'falsy' }).isString().trim().isLength({ max }).withMessage(`That is too long (maximum ${max} characters).`);
const list = (field, label, maxItems, maxLen) => [
  body(field).optional().isArray({ max: maxItems }).withMessage(`${label}: at most ${maxItems} items.`),
  body(`${field}.*`).optional().isString().trim().isLength({ min: 1, max: maxLen }).withMessage(`${label}: each item can be up to ${maxLen} characters.`),
];

const doctorFields = [
  body('name').isString().withMessage("Please enter the doctor's full name.").bail().trim()
    .custom((v) => v.replace(/^dr\.?\s*/i, '').trim().split(/\s+/).filter(Boolean).length >= 2).withMessage("Please enter the doctor's full name (first and last name).").bail()
    .isLength({ max: 80 }).withMessage('That name is too long (maximum 80 characters).'),
  body('phone').isString().withMessage('Please enter a mobile number.').bail().trim().matches(INDIAN_MOBILE_REGEX).withMessage('Please enter a valid mobile number.'),
  text('specialization', 'Please enter the specialization.', 80),
  body('department').isMongoId().withMessage('Please choose a department.'),
  optText('qualification', 150),
  body('experience').isInt({ min: 0, max: 70 }).withMessage('Experience must be between 0 and 70 years.').toInt(),
  body('gender').optional({ values: 'falsy' }).isIn(GENDERS).withMessage('Please choose a valid gender.'),
  ...list('languages', 'Languages', 8, 30),
  text('registrationNumber', 'Please enter the registration number.', 40),
  text('location', 'Please enter the city.', 80),
  optText('branch', 80),
  body('consultationFee').isInt({ min: 0, max: 100000 }).withMessage('Fee must be a whole number between 0 and 100000.').toInt(),
  optText('about', 3000),
  ...list('conditionsTreated', 'Conditions treated', 20, 60),
  ...list('procedures', 'Procedures', 20, 60),
  body('consultationTypes').isArray({ min: 1 }).withMessage('Choose at least one visit type.'),
  body('consultationTypes.*').isIn(CONSULTATION_TYPES).withMessage('Invalid visit type.'),
  body('profileImage').optional({ values: 'falsy' }).isString().trim().isLength({ max: 300 }).matches(/^(\/images\/|https:\/\/)/).withMessage('The photo must be an /images/ path or an https:// link.'),
];

const createDoctorRules = [
  body('email').isString().withMessage('Please enter the email.').bail().trim().isEmail().withMessage('Please enter a valid email address.').bail().isLength({ max: 254 }).toLowerCase(),
  body('password').isString().withMessage('Please enter a starting password.').bail()
    .isLength({ min: 8 }).withMessage('Password must contain at least 8 characters.').bail().isLength({ max: 72 }).withMessage('Password must be 72 characters or fewer.').bail()
    .matches(/[a-z]/).withMessage('Password must include a lowercase letter.').bail().matches(/[A-Z]/).withMessage('Password must include an uppercase letter.').bail().matches(/\d/).withMessage('Password must include a number.'),
  ...doctorFields,
];
const updateDoctorRules = [idParam, ...doctorFields];

const statusRules = [idParam, body('status').isIn(['active', 'inactive']).withMessage('Status must be active or inactive.')];
const patientStatusRules = [idParam, body('isActive').isBoolean({ strict: true }).withMessage('Please choose active or inactive.')];

const departmentRules = [
  text('name', 'Please enter the department name.', 60),
  optText('description', 1000),
  body('icon').optional({ values: 'falsy' }).isString().trim().matches(/^fa-[a-z0-9-]{2,40}$/).withMessage('The icon must look like fa-heart-pulse.'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive.'),
];
const updateDepartmentRules = [idParam, ...departmentRules];

const pageQuery = [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 50 })];
const doctorListRules = [...pageQuery, query('status').optional({ values: 'falsy' }).isIn(['active', 'inactive']), query('department').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid department.')];
const patientListRules = [...pageQuery, query('status').optional({ values: 'falsy' }).isIn(['active', 'inactive'])];
const appointmentListRules = [
  ...pageQuery,
  query('status').optional({ values: 'falsy' }).isIn(APPOINTMENT_STATUSES).withMessage('Unknown status.'),
  query('date').optional({ values: 'falsy' }).custom(isValidDateString).withMessage('Please choose a valid date.'),
  query('doctor').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid doctor.'),
];
const cancelRules = [idParam, body('reason').isString().withMessage('Please give a reason.').bail().trim().isLength({ min: 3, max: 300 }).withMessage('Please give a reason (3 to 300 characters).')];
const analyticsRules = [query('days').optional().isIn(['7', '30', '90']).withMessage('Choose 7, 30 or 90 days.')];
const auditRules = [
  ...pageQuery,
  query('action').optional({ values: 'falsy' }).matches(/^[A-Z_]{3,60}$/).withMessage('Unknown action.'),
  query('from').optional({ values: 'falsy' }).custom(isValidDateString).withMessage('Please choose a valid start date.'),
  query('to').optional({ values: 'falsy' }).custom(isValidDateString).withMessage('Please choose a valid end date.'),
];

module.exports = { idParam, createDoctorRules, updateDoctorRules, statusRules, patientStatusRules, departmentRules, updateDepartmentRules, doctorListRules, patientListRules, appointmentListRules, cancelRules, analyticsRules, auditRules };

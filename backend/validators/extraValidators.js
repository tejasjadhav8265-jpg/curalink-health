const { body, query, param } = require('express-validator');
const { INDIAN_MOBILE_REGEX, ARTICLE_CATEGORIES } = require('../utils/constants');
const { isValidDateString, todayIST, addDays } = require('../utils/dates');

const EMERGENCY_TYPES = ['Accident or injury', 'Chest pain or heart problem', 'Breathing difficulty', 'Pregnancy or delivery', 'Stroke symptoms', 'Burns', 'Poisoning', 'Other'];
const INSURERS = ['Star Health', 'HDFC ERGO', 'ICICI Lombard', 'Niva Bupa', 'Care Health', 'Bajaj Allianz', 'Ayushman Bharat (PM-JAY)', 'Other'];

const idParam = param('id').isMongoId().withMessage('Invalid link.');
const text = (field, label, max) => body(field).isString().withMessage(`Please enter ${label}.`).bail().trim().notEmpty().withMessage(`Please enter ${label}.`).bail().isLength({ max }).withMessage(`That is too long (maximum ${max} characters).`);
const mobile = (field, required = true) => (required
  ? body(field).isString().withMessage('Please enter a mobile number.').bail().trim().matches(INDIAN_MOBILE_REGEX).withMessage('Please enter a valid mobile number.')
  : body(field).optional({ values: 'falsy' }).isString().trim().matches(INDIAN_MOBILE_REGEX).withMessage('Please enter a valid mobile number.'));
const stars = (field, label) => body(field).isInt({ min: 1, max: 5 }).withMessage(`Please rate ${label} from 1 to 5.`).toInt();

const contactRules = [
  text('name', 'your name', 100),
  body('email').isString().withMessage('Please enter your email.').bail().trim().isEmail().withMessage('Please enter a valid email address.').bail().isLength({ max: 254 }).toLowerCase(),
  mobile('phone', false),
  text('subject', 'a subject', 150),
  body('message').isString().withMessage('Please enter your message.').bail().trim().isLength({ min: 10, max: 2000 }).withMessage('Please write a message of 10 to 2000 characters.'),
];

const emergencyRules = [
  text('patientName', "the patient's name", 100),
  mobile('phone'),
  text('pickupLocation', 'the pickup location', 300),
  body('emergencyType').isIn(EMERGENCY_TYPES).withMessage('Please choose the emergency type.'),
  body('patientCount').optional({ values: 'falsy' }).isInt({ min: 1, max: 20 }).withMessage('Number of patients must be between 1 and 20.').toInt(),
  body('additionalInfo').optional({ values: 'falsy' }).isString().trim().isLength({ max: 1000 }).withMessage('That is too long (maximum 1000 characters).'),
];

const articleListRules = [
  query('category').optional({ values: 'falsy' }).isIn(ARTICLE_CATEGORIES).withMessage('Unknown category.'),
  query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 24 }),
];

const specialtyRules = [query('text').isString().withMessage('Please describe how you feel.').bail().trim().isLength({ min: 3, max: 400 }).withMessage('Please write 3 to 400 characters.')];

const bookPackageRules = [
  idParam,
  body('preferredDate').isString().custom(isValidDateString).withMessage('Please choose a valid date.').bail()
    .custom((v) => v >= todayIST()).withMessage('Please choose today or a later date.').bail()
    .custom((v) => v <= addDays(todayIST(), 90)).withMessage('Please choose a date within the next 90 days.'),
];

const insuranceRules = [
  body('provider').isIn(INSURERS).withMessage('Please choose your insurance provider.'),
  body('policyNumber').isString().withMessage('Please enter your policy number.').bail().trim().matches(/^[A-Za-z0-9][A-Za-z0-9\-/ ]{3,29}$/).withMessage('The policy number should have 4 to 30 letters, numbers, spaces, - or /.'),
  body('patientIdRef').optional({ values: 'falsy' }).isString().trim().matches(/^[A-Za-z0-9\-/ ]{2,30}$/).withMessage('The member ID should have 2 to 30 letters, numbers, spaces, - or /.'),
];

const feedbackRules = [
  body('appointmentId').isMongoId().withMessage('Please choose a visit to review.'),
  stars('doctorRating', 'the doctor'), stars('hospitalRating', 'the hospital'), stars('staffRating', 'the staff'),
  body('comment').optional({ values: 'falsy' }).isString().trim().isLength({ max: 1000 }).withMessage('Your comment is too long (maximum 1000 characters).'),
];

const roomIdParam = param('appointmentId').isMongoId().withMessage('Invalid link.');
const roomMessageRules = [roomIdParam, body('text').isString().withMessage('Please type a message.').bail().trim().isLength({ min: 1, max: 1000 }).withMessage('Messages can be 1 to 1000 characters.')];

const inboxKinds = ['contact', 'emergency', 'insurance', 'packages', 'feedback'];
const inboxListRules = [param('kind').isIn(inboxKinds).withMessage('Unknown list.'), query('status').optional({ values: 'falsy' }).isString().isLength({ max: 20 }), query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 50 })];
const inboxStatusRules = [param('kind').isIn(inboxKinds).withMessage('Unknown list.'), idParam, body('status').isString().withMessage('Please choose a status.').bail().isLength({ max: 20 })];

module.exports = { EMERGENCY_TYPES, INSURERS, idParam, contactRules, emergencyRules, articleListRules, specialtyRules, bookPackageRules, insuranceRules, feedbackRules, roomIdParam, roomMessageRules, inboxListRules, inboxStatusRules };

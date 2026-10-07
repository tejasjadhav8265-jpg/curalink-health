const { body, param, query } = require('express-validator');
const { isValidDateString, todayIST } = require('../utils/dates');
const { ACTIONS } = require('../services/appointmentRules');

const idParam = param('id').isMongoId().withMessage('Invalid identifier.');
const patientParam = param('patientId').isMongoId().withMessage('Invalid patient.');
const reportParam = param('reportId').isMongoId().withMessage('Invalid report.');

const statusRules = [
  idParam,
  body('action').isIn(Object.keys(ACTIONS)).withMessage('Please choose a valid action.'),
  body('reason').optional({ values: 'falsy' }).isString().trim().isLength({ max: 300 }).withMessage('The reason is too long (maximum 300 characters).'),
];

const listRules = [
  query('tab').optional().isIn(['today', 'pending', 'upcoming', 'history', 'cancelled']).withMessage('Unknown tab.'),
];

const consultationRules = [
  idParam,
  body('symptoms').optional({ values: 'falsy' }).isString().trim().isLength({ max: 2000 }).withMessage('Symptoms are too long (maximum 2000 characters).'),
  body('observations').optional({ values: 'falsy' }).isString().trim().isLength({ max: 2000 }).withMessage('Observations are too long (maximum 2000 characters).'),
  body('note').isString().withMessage('Please write a consultation note.').bail().trim().notEmpty().withMessage('Please write a consultation note.').bail()
    .isLength({ max: 4000 }).withMessage('The note is too long (maximum 4000 characters).'),
];

const medText = (field, msg, max = 100) =>
  body(`medicines.*.${field}`).isString().withMessage(msg).bail().trim().notEmpty().withMessage(msg).bail()
    .isLength({ max }).withMessage(`That is too long (maximum ${max} characters).`);

const prescriptionBody = [
  body('diagnosis').isString().withMessage('Please enter the diagnosis.').bail().trim().notEmpty().withMessage('Please enter the diagnosis.').bail()
    .isLength({ max: 500 }).withMessage('The diagnosis is too long (maximum 500 characters).'),
  body('medicines').isArray({ min: 1, max: 15 }).withMessage('Add between 1 and 15 medicines.'),
  medText('name', 'Please enter each medicine name.'),
  medText('dosage', 'Please enter the dosage for each medicine.'),
  medText('frequency', 'Please enter how often each medicine is taken.'),
  medText('duration', 'Please enter how long each medicine is taken.'),
  body('medicines.*.instructions').optional({ values: 'falsy' }).isString().trim().isLength({ max: 200 }).withMessage('Instructions are too long (maximum 200 characters).'),
  body('advice').optional({ values: 'falsy' }).isString().trim().isLength({ max: 1000 }).withMessage('Advice is too long (maximum 1000 characters).'),
  body('followUpDate').optional({ values: 'falsy' }).custom((v) => isValidDateString(v) && v >= todayIST()).withMessage('Please choose a follow-up date that is today or later.'),
];

const createPrescriptionRules = [body('appointmentId').isMongoId().withMessage('Please choose an appointment.'), ...prescriptionBody];
const updatePrescriptionRules = [idParam, ...prescriptionBody];

const patientListRules = [query('q').optional().isString().trim().isLength({ max: 60 }).withMessage('Search text is too long.')];

module.exports = { idParam, patientParam, reportParam, statusRules, listRules, consultationRules, createPrescriptionRules, updatePrescriptionRules, patientListRules };

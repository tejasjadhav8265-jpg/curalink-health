const router = require('express').Router();
const a = require('../controllers/adminController');
const doctors = require('../controllers/adminDoctorController');
const patients = require('../controllers/adminPatientController');
const departments = require('../controllers/adminDepartmentController');
const inbox = require('../controllers/adminInboxController');
const x = require('../validators/extraValidators');
const v = require('../validators/adminValidators');
const validate = require('../middleware/validate');
const { authenticateUser } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roles');

router.use(authenticateUser, requireAdmin); // every admin route needs a logged-in admin

router.get('/dashboard', a.dashboard);
router.get('/analytics', v.analyticsRules, validate, a.analytics);
router.get('/audit-logs', v.auditRules, validate, a.auditLogs);

router.get('/doctors', v.doctorListRules, validate, doctors.list);
router.post('/doctors', v.createDoctorRules, validate, doctors.create);
router.get('/doctors/:id', v.idParam, validate, doctors.getOne);
router.put('/doctors/:id', v.updateDoctorRules, validate, doctors.update);
router.patch('/doctors/:id/status', v.statusRules, validate, doctors.setStatus);

router.get('/patients', v.patientListRules, validate, patients.list);
router.get('/patients/:id', v.idParam, validate, patients.getOne);
router.patch('/patients/:id/status', v.patientStatusRules, validate, patients.setStatus);

router.get('/departments', departments.list);
router.post('/departments', v.departmentRules, validate, departments.create);
router.put('/departments/:id', v.updateDepartmentRules, validate, departments.update);
router.delete('/departments/:id', v.idParam, validate, departments.remove);

router.get('/appointments', v.appointmentListRules, validate, a.appointments);
router.put('/appointments/:id/cancel', v.cancelRules, validate, a.cancelAppointment);

router.get('/inbox', inbox.counts);
router.get('/inbox/:kind', x.inboxListRules, validate, inbox.list);
router.patch('/inbox/:kind/:id', x.inboxStatusRules, validate, inbox.setStatus);

module.exports = router;

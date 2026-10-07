const router = require('express').Router();
const c = require('../controllers/doctorPortalController');
const v = require('../validators/doctorPortalValidators');
const validate = require('../middleware/validate');
const { authenticateUser } = require('../middleware/auth');
const { requireDoctor } = require('../middleware/roles');

router.use(authenticateUser, requireDoctor);
router.get('/dashboard', c.dashboard);
router.get('/queue', c.queue);
router.get('/appointments', v.listRules, validate, c.appointments);
router.get('/appointments/:id', v.idParam, validate, c.consultation);
router.put('/appointments/:id/status', v.statusRules, validate, c.updateStatus);
router.put('/appointments/:id/consultation', v.consultationRules, validate, c.saveConsultation);
router.get('/patients', v.patientListRules, validate, c.patients);
router.get('/patients/:patientId', v.patientParam, validate, c.patientDetails);
router.get('/patients/:patientId/reports/:reportId/download', v.patientParam, v.reportParam, validate, c.downloadPatientReport);

module.exports = router;

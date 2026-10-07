const router = require('express').Router();
const c = require('../controllers/prescriptionController');
const { idParam } = require('../validators/patientValidators');
const { createPrescriptionRules, updatePrescriptionRules } = require('../validators/doctorPortalValidators');
const validate = require('../middleware/validate');
const { authenticateUser } = require('../middleware/auth');
const { requireDoctor } = require('../middleware/roles');

router.use(authenticateUser); // patients, doctors and admins: each only sees what belongs to them
router.get('/', c.list);
router.post('/', requireDoctor, createPrescriptionRules, validate, c.create);   // Phase 6
router.get('/:id', idParam, validate, c.getOne);
router.get('/:id/pdf', idParam, validate, c.pdf);
router.put('/:id', requireDoctor, updatePrescriptionRules, validate, c.update); // Phase 6

module.exports = router;

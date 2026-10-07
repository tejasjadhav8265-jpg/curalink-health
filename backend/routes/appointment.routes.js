const router = require('express').Router();
const controller = require('../controllers/appointmentController');
const { createRules, rescheduleRules, cancelRules, idParam } = require('../validators/appointmentValidators');
const validate = require('../middleware/validate');
const { authenticateUser } = require('../middleware/auth');
const { requirePatient } = require('../middleware/roles');

router.use(authenticateUser);
router.post('/', requirePatient, createRules, validate, controller.create);
router.get('/', controller.list);
router.get('/:id', idParam, validate, controller.getOne);
router.put('/:id/reschedule', requirePatient, rescheduleRules, validate, controller.reschedule);
router.put('/:id/cancel', requirePatient, cancelRules, validate, controller.cancel);
// Doctor accept / reject / complete arrive in Phase 6.

module.exports = router;

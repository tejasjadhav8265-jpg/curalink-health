const router = require('express').Router();
const c = require('../controllers/teleconsultController');
const v = require('../validators/extraValidators');
const validate = require('../middleware/validate');
const { authenticateUser } = require('../middleware/auth');
const { requireRoles } = require('../middleware/roles');

router.use(authenticateUser, requireRoles('patient', 'doctor'));
router.get('/:appointmentId', v.roomIdParam, validate, c.view);
router.post('/:appointmentId/start', v.roomIdParam, validate, c.start);
router.post('/:appointmentId/end', v.roomIdParam, validate, c.end);
router.post('/:appointmentId/messages', v.roomMessageRules, validate, c.send);

module.exports = router;

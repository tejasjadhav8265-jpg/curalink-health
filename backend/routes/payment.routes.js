const router = require('express').Router();
const controller = require('../controllers/paymentController');
const { demoPayRules } = require('../validators/paymentValidators');
const validate = require('../middleware/validate');
const { authenticateUser } = require('../middleware/auth');
const { requirePatient } = require('../middleware/roles');

router.use(authenticateUser, requirePatient);
router.post('/demo', demoPayRules, validate, controller.payDemo);
router.get('/', controller.list);

module.exports = router;

const router = require('express').Router();
const c = require('../controllers/insuranceController');
const v = require('../validators/extraValidators');
const validate = require('../middleware/validate');
const { authenticateUser } = require('../middleware/auth');
const { requirePatient } = require('../middleware/roles');

router.get('/providers', c.providers);
router.get('/mine', authenticateUser, requirePatient, c.mine);
router.post('/', authenticateUser, requirePatient, v.insuranceRules, validate, c.submit);

module.exports = router;

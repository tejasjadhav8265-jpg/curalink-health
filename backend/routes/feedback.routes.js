const router = require('express').Router();
const c = require('../controllers/feedbackController');
const v = require('../validators/extraValidators');
const validate = require('../middleware/validate');
const { authenticateUser } = require('../middleware/auth');
const { requirePatient } = require('../middleware/roles');

router.use(authenticateUser, requirePatient);
router.get('/pending', c.pending);
router.get('/mine', c.mine);
router.post('/', v.feedbackRules, validate, c.create);

module.exports = router;

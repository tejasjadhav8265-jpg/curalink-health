const router = require('express').Router();
const controller = require('../controllers/availabilityController');
const { saveRules, blockRules, unblockRules } = require('../validators/availabilityValidators');
const validate = require('../middleware/validate');
const { authenticateUser } = require('../middleware/auth');
const { requireDoctor } = require('../middleware/roles');

router.use(authenticateUser, requireDoctor);
router.get('/', controller.get);
router.put('/', saveRules, validate, controller.save);
router.post('/block-date', blockRules, validate, controller.blockDate);
router.delete('/block-date/:date', unblockRules, validate, controller.unblockDate);

module.exports = router;

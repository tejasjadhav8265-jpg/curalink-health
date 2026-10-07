const router = require('express').Router();
const controller = require('../controllers/searchController');
const { recordSearchRules, clickRules } = require('../validators/searchValidators');
const validate = require('../middleware/validate');
const { authenticateUser, optionalAuth } = require('../middleware/auth');

router.post('/', optionalAuth, recordSearchRules, validate, controller.record);
router.patch('/:id/click', clickRules, validate, controller.markClick);
router.get('/', authenticateUser, controller.list);

module.exports = router;

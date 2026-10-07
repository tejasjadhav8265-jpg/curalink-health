const router = require('express').Router();
const controller = require('../controllers/doctorController');
const slotController = require('../controllers/slotController');
const { slotsRules } = require('../validators/appointmentValidators');
const validate = require('../middleware/validate');

router.get('/', controller.list);
router.get('/facets', controller.facets); // must stay above '/:id'
router.get('/:id/slots', slotsRules, validate, slotController.getSlots);
router.get('/:id', controller.getOne);
// Admin create/update/deactivate arrive in Phase 7.

module.exports = router;

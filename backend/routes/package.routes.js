const router = require('express').Router();
const c = require('../controllers/packageController');
const v = require('../validators/extraValidators');
const validate = require('../middleware/validate');
const { authenticateUser } = require('../middleware/auth');
const { requirePatient } = require('../middleware/roles');

router.get('/', c.list);
router.get('/mine', authenticateUser, requirePatient, c.mine);
router.patch('/bookings/:id/cancel', authenticateUser, requirePatient, v.idParam, validate, c.cancel);
router.post('/:id/book', authenticateUser, requirePatient, v.bookPackageRules, validate, c.book);

module.exports = router;

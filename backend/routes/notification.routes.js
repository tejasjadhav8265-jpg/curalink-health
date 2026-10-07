const router = require('express').Router();
const c = require('../controllers/notificationController');
const { idParam } = require('../validators/patientValidators');
const validate = require('../middleware/validate');
const { authenticateUser } = require('../middleware/auth');

router.use(authenticateUser);
router.get('/', c.list);
router.get('/unread-count', c.unreadCount);
router.patch('/read-all', c.markAllRead); // must stay above '/:id/read'
router.patch('/:id/read', idParam, validate, c.markRead);
router.delete('/:id', idParam, validate, c.remove);

module.exports = router;

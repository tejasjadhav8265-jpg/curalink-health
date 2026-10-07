const router = require('express').Router();
const controller = require('../controllers/authController');
const { registerRules, loginRules } = require('../validators/authValidators');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimit');
const { authenticateUser } = require('../middleware/auth');

router.post('/register', authLimiter, registerRules, validate, controller.register);
router.post('/login', authLimiter, loginRules, validate, controller.login);
router.post('/logout', controller.logout);
router.get('/me', authenticateUser, controller.me);

module.exports = router;

const router = require('express').Router();
const c = require('../controllers/patientController');
const { profileRules, passwordRules, recordRules } = require('../validators/patientValidators');
const validate = require('../middleware/validate');
const { authenticateUser } = require('../middleware/auth');
const { requirePatient } = require('../middleware/roles');
const { authLimiter } = require('../middleware/rateLimit');

router.use(authenticateUser, requirePatient);
router.get('/dashboard', c.dashboard);
router.get('/profile', c.getProfile);
router.put('/profile', profileRules, validate, c.updateProfile);
router.put('/password', authLimiter, passwordRules, validate, c.changePassword); // slowed down like login
router.get('/record', c.getRecord);
router.put('/record', recordRules, validate, c.updateRecord);

module.exports = router;

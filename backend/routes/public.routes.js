const router = require('express').Router();
const c = require('../controllers/publicController');
const v = require('../validators/extraValidators');
const validate = require('../middleware/validate');
const { optionalAuth } = require('../middleware/auth');
const { formLimiter } = require('../middleware/rateLimit');

router.get('/meta', c.meta);
router.post('/contact', formLimiter, v.contactRules, validate, c.contact);
router.post('/emergency', formLimiter, optionalAuth, v.emergencyRules, validate, c.emergency);
router.get('/articles', v.articleListRules, validate, c.articles);
router.get('/articles/:slug', c.article);
router.get('/specialty-finder', v.specialtyRules, validate, c.specialtyFinder);

module.exports = router;

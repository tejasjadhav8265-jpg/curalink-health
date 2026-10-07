const router = require('express').Router();
const c = require('../controllers/reportController');
const { idParam } = require('../validators/patientValidators');
const validate = require('../middleware/validate');
const { uploadSingle } = require('../middleware/upload');
const { authenticateUser } = require('../middleware/auth');
const { requirePatient } = require('../middleware/roles');

router.use(authenticateUser, requirePatient);
router.get('/', c.list);
router.post('/', uploadSingle, c.upload); // multer reads the file first, the controller checks the rest
router.get('/:id/download', idParam, validate, c.download);
router.delete('/:id', idParam, validate, c.remove);

module.exports = router;

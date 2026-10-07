const router = require('express').Router();
const controller = require('../controllers/departmentController');

router.get('/', controller.list);
router.get('/:idOrSlug', controller.getOne);

module.exports = router;

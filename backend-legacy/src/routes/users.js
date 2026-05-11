const { Router } = require('express');
const userController = require('../controllers/userController');
const auth = require('../middlewares/auth');

const router = Router();

router.get('/', auth, userController.getUsers);
router.get('/:id', auth, userController.getUser);

module.exports = router;

const { Router } = require('express');
const groupController = require('../controllers/groupController');
const auth = require('../middlewares/auth');

const router = Router();

router.post('/',          auth, groupController.create);
router.get('/',           auth, groupController.list);
router.post('/join',      auth, groupController.join);
router.get('/:id',        auth, groupController.get);
router.put('/:id',        auth, groupController.update);
router.delete('/:id',     auth, groupController.remove);
router.post('/:id/leave', auth, groupController.leave);
router.post('/:id/kick/:userId', auth, groupController.kick);
router.get('/:id/invite-code',   auth, groupController.refreshInvite);

module.exports = router;

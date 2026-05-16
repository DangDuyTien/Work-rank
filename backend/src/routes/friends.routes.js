const express = require('express');
const controller = require('../controllers/friends.controller');
const { auth } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(auth);
router.get('/', asyncHandler(controller.list));
router.get('/requests', asyncHandler(controller.requests));
router.post('/requests', asyncHandler(controller.sendRequest));
router.post('/requests/:id/accept', asyncHandler(controller.accept));
router.post('/requests/:id/decline', asyncHandler(controller.decline));
router.delete('/requests/:id', asyncHandler(controller.cancel));
router.delete('/:userId', asyncHandler(controller.remove));

module.exports = router;

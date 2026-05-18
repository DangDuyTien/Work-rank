const express = require('express');
const controller = require('../controllers/tradingView.controller');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get('/candles', asyncHandler(controller.candles));

module.exports = router;

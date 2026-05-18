const tradingViewService = require('../services/tradingView.service');

async function receiveWebhook(req, res) {
  const result = await tradingViewService.ingestWebhook(
    req.body,
    tradingViewService.bodyBytesFromRequest(req),
  );
  res.json(result);
}

async function candles(req, res) {
  res.json(await tradingViewService.listCandles(req.query));
}

async function debug(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json(await tradingViewService.debugState());
}

module.exports = { receiveWebhook, candles, debug };

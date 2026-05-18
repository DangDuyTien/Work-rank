const crypto = require('crypto');
const { Op } = require('sequelize');
const {
  sequelize,
  TradingViewCandle,
  TradingViewWebhookAttempt,
} = require('../models');

const SUPPORTED_SYMBOL = 'XAUUSD';
const SUPPORTED_TIMEFRAMES = ['1m', '5m', '15m'];
const MAX_CANDLES = 500;
const RECENT_ATTEMPTS_LIMIT = 20;

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeSymbol(...values) {
  const text = values
    .filter((value) => value !== undefined && value !== null)
    .map((value) => String(value).toUpperCase())
    .join(' ');

  if (text.includes('XAUUSD') || text.includes('GOLD')) return SUPPORTED_SYMBOL;
  return null;
}

function normalizeSymbolFromPayload(payload = {}) {
  return normalizeSymbol(payload.symbol, payload.ticker, payload.tickerid);
}

function normalizeTimeframe(value) {
  if (value === undefined || value === null || value === '') return null;
  const normalized = String(value).trim().toLowerCase().replace(/\s+/g, '');
  const map = {
    '1': '1m',
    '1m': '1m',
    '1min': '1m',
    '1minute': '1m',
    '5': '5m',
    '5m': '5m',
    '5min': '5m',
    '5minute': '5m',
    '15': '15m',
    '15m': '15m',
    '15min': '15m',
    '15minute': '15m',
  };
  return map[normalized] || null;
}

function toFiniteNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeTime(value) {
  const number = toFiniteNumber(value);
  if (number === null || number <= 0) return null;
  return Math.floor(number >= 1000000000000 ? number / 1000 : number);
}

function normalizeVolume(value, label) {
  if (value === undefined || value === null || value === '') return null;
  const volume = toFiniteNumber(value);
  if (volume === null) throw httpError(400, `Invalid candle volume: ${label}`);
  return volume;
}

function candleHasAnyField(raw) {
  return ['time', 't', 'open', 'o', 'high', 'h', 'low', 'l', 'close', 'c', 'volume', 'v']
    .some((key) => raw[key] !== undefined);
}

function normalizeCandle(raw, label) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw httpError(400, `Invalid candle object: ${label}`);
  }

  const time = normalizeTime(raw.time ?? raw.t);
  const open = toFiniteNumber(raw.open ?? raw.o);
  const high = toFiniteNumber(raw.high ?? raw.h);
  const low = toFiniteNumber(raw.low ?? raw.l);
  const close = toFiniteNumber(raw.close ?? raw.c);
  const volume = normalizeVolume(raw.volume ?? raw.v, label);

  if (time === null) throw httpError(400, `Invalid candle time: ${label}`);
  if (open === null) throw httpError(400, `Invalid candle open: ${label}`);
  if (high === null) throw httpError(400, `Invalid candle high: ${label}`);
  if (low === null) throw httpError(400, `Invalid candle low: ${label}`);
  if (close === null) throw httpError(400, `Invalid candle close: ${label}`);

  return { time, open, high, low, close, volume };
}

function normalizeCandlesFromPayload(payload) {
  const candles = [];
  const history = Array.isArray(payload.history) ? payload.history : [];
  const payloadCandles = Array.isArray(payload.candles) ? payload.candles : [];

  history.forEach((item, index) => {
    candles.push(normalizeCandle(item, `history[${index}]`));
  });
  payloadCandles.forEach((item, index) => {
    candles.push(normalizeCandle(item, `candles[${index}]`));
  });

  if (candleHasAnyField(payload)) {
    candles.push(normalizeCandle(payload, 'current'));
  }

  if (!candles.length) throw httpError(400, 'No candles provided');

  const byTime = new Map();
  candles.forEach((candle) => {
    byTime.set(candle.time, candle);
  });

  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

function normalizeClosed(payload = {}) {
  const value = payload.confirmed ?? payload.closed;
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
  }
  return Boolean(value);
}

function bodyBytesFromRequest(req) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody.length;
  const contentLength = Number(req.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength >= 0) return contentLength;
  return Buffer.byteLength(JSON.stringify(req.body || {}));
}

function formatCandle(row) {
  return {
    time: Number(row.time),
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: row.volume === null || row.volume === undefined ? null : Number(row.volume),
  };
}

function formatAttempt(row) {
  const attempt = {
    receivedAt: row.receivedAt instanceof Date ? row.receivedAt.toISOString() : new Date(row.receivedAt).toISOString(),
    status: row.status,
    bodyBytes: Number(row.bodyBytes || 0),
    symbol: row.symbol || null,
    timeframe: row.timeframe || null,
    closed: row.closed === null || row.closed === undefined ? null : Boolean(row.closed),
  };
  if (row.error) attempt.error = row.error;
  return attempt;
}

function isSecretConfigured() {
  return Boolean(process.env.TRADINGVIEW_WEBHOOK_SECRET);
}

function secretsMatch(received, configured) {
  if (typeof received !== 'string' || typeof configured !== 'string') return false;
  const receivedBuffer = Buffer.from(received);
  const configuredBuffer = Buffer.from(configured);
  return receivedBuffer.length === configuredBuffer.length
    && crypto.timingSafeEqual(receivedBuffer, configuredBuffer);
}

async function pruneCandles(symbol, timeframe, transaction) {
  const count = await TradingViewCandle.count({ where: { symbol, timeframe }, transaction });
  if (count <= MAX_CANDLES) return;

  const staleRows = await TradingViewCandle.findAll({
    attributes: ['id'],
    where: { symbol, timeframe },
    order: [['time', 'ASC'], ['id', 'ASC']],
    limit: count - MAX_CANDLES,
    raw: true,
    transaction,
  });
  const ids = staleRows.map((row) => row.id);
  if (!ids.length) return;
  await TradingViewCandle.destroy({ where: { id: { [Op.in]: ids } }, transaction });
}

async function mergeCandles(symbol, timeframe, candles) {
  await sequelize.transaction(async (transaction) => {
    for (const candle of candles) {
      await TradingViewCandle.upsert(
        { symbol, timeframe, ...candle },
        { transaction },
      );
    }
    await pruneCandles(symbol, timeframe, transaction);
  });
}

async function pruneAttempts() {
  const count = await TradingViewWebhookAttempt.count();
  if (count <= RECENT_ATTEMPTS_LIMIT) return;

  const staleRows = await TradingViewWebhookAttempt.findAll({
    attributes: ['id'],
    order: [['receivedAt', 'ASC'], ['id', 'ASC']],
    limit: count - RECENT_ATTEMPTS_LIMIT,
    raw: true,
  });
  const ids = staleRows.map((row) => row.id);
  if (!ids.length) return;
  await TradingViewWebhookAttempt.destroy({ where: { id: { [Op.in]: ids } } });
}

async function recordAttempt(attempt) {
  try {
    await TradingViewWebhookAttempt.create({
      ...attempt,
      error: attempt.error ? String(attempt.error).slice(0, 255) : null,
    });
    await pruneAttempts();
  } catch (error) {
    console.warn('TradingView webhook attempt log failed:', error.message);
  }
}

function attemptBase(payload, bodyBytes, receivedAt) {
  return {
    receivedAt,
    bodyBytes: Math.max(0, Number(bodyBytes || 0)),
    symbol: normalizeSymbolFromPayload(payload),
    timeframe: normalizeTimeframe(payload.timeframe),
    closed: normalizeClosed(payload),
  };
}

async function ingestWebhook(body, bodyBytes) {
  const receivedAt = new Date();
  const payload = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const base = attemptBase(payload, bodyBytes, receivedAt);

  try {
    if (payload !== body) throw httpError(400, 'Request body must be a JSON object');

    const configuredSecret = process.env.TRADINGVIEW_WEBHOOK_SECRET;
    if (!configuredSecret) throw httpError(503, 'TRADINGVIEW_WEBHOOK_SECRET is not configured');
    if (!secretsMatch(payload.secret, configuredSecret)) throw httpError(401, 'Invalid TradingView webhook secret');

    const symbol = normalizeSymbolFromPayload(payload);
    if (symbol !== SUPPORTED_SYMBOL) throw httpError(400, 'Unsupported TradingView symbol');

    const timeframe = normalizeTimeframe(payload.timeframe);
    if (!SUPPORTED_TIMEFRAMES.includes(timeframe)) throw httpError(400, 'Unsupported TradingView timeframe');

    const candles = normalizeCandlesFromPayload(payload);
    await mergeCandles(symbol, timeframe, candles);
    await recordAttempt({ ...base, status: 'accepted', symbol, timeframe, error: null });

    return {
      ok: true,
      symbol,
      timeframe,
      receivedCandles: candles.length,
    };
  } catch (error) {
    await recordAttempt({
      ...base,
      status: 'rejected',
      error: error.message || 'TradingView webhook rejected',
    });
    throw error;
  }
}

async function listCandles(query) {
  const symbol = normalizeSymbol(query.symbol);
  if (symbol !== SUPPORTED_SYMBOL) throw httpError(400, 'Unsupported or missing symbol');

  const timeframe = normalizeTimeframe(query.timeframe);
  if (!SUPPORTED_TIMEFRAMES.includes(timeframe)) throw httpError(400, 'Unsupported or missing timeframe');

  const rows = await TradingViewCandle.findAll({
    where: { symbol, timeframe },
    order: [['time', 'ASC']],
    limit: MAX_CANDLES,
  });

  return {
    ok: true,
    symbol,
    timeframe,
    candles: rows.map(formatCandle),
  };
}

async function debugState() {
  const candleCounts = {
    [SUPPORTED_SYMBOL]: {},
  };

  await Promise.all(SUPPORTED_TIMEFRAMES.map(async (timeframe) => {
    candleCounts[SUPPORTED_SYMBOL][timeframe] = await TradingViewCandle.count({
      where: { symbol: SUPPORTED_SYMBOL, timeframe },
    });
  }));

  const attempts = await TradingViewWebhookAttempt.findAll({
    order: [['receivedAt', 'DESC'], ['id', 'DESC']],
    limit: RECENT_ATTEMPTS_LIMIT,
  });

  return {
    ok: true,
    secretConfigured: isSecretConfigured(),
    candleCounts,
    recentAttempts: attempts.map(formatAttempt),
  };
}

module.exports = {
  bodyBytesFromRequest,
  debugState,
  ingestWebhook,
  listCandles,
  normalizeSymbol,
  normalizeTimeframe,
};

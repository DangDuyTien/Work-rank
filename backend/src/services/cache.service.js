const DEFAULT_TTL_SECONDS = 10;

let redisClient = null;
let redisReady = false;
let redisInitStarted = false;
const memoryStore = new Map();

function cleanupMemory() {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.expiresAt <= now) memoryStore.delete(key);
  }
}

async function initRedis() {
  if (redisInitStarted || !process.env.REDIS_URL) return;
  redisInitStarted = true;
  try {
    const { createClient } = require('redis');
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.on('error', (error) => {
      redisReady = false;
      console.warn('Redis cache error:', error.message);
    });
    redisClient.on('ready', () => {
      redisReady = true;
    });
    await redisClient.connect();
  } catch (error) {
    redisReady = false;
    redisClient = null;
    console.warn('Redis cache disabled:', error.message);
  }
}

async function getJson(key) {
  await initRedis();
  if (redisReady && redisClient) {
    const raw = await redisClient.get(key);
    return raw ? JSON.parse(raw) : null;
  }

  cleanupMemory();
  const entry = memoryStore.get(key);
  return entry && entry.expiresAt > Date.now() ? entry.value : null;
}

async function setJson(key, value, ttlSeconds = DEFAULT_TTL_SECONDS) {
  await initRedis();
  const ttl = Math.max(1, Number(ttlSeconds || DEFAULT_TTL_SECONDS));
  if (redisReady && redisClient) {
    await redisClient.set(key, JSON.stringify(value), { EX: ttl });
    return;
  }

  cleanupMemory();
  memoryStore.set(key, {
    value,
    expiresAt: Date.now() + ttl * 1000,
  });
}

async function rememberJson(key, ttlSeconds, producer) {
  const cached = await getJson(key);
  if (cached !== null && cached !== undefined) return cached;
  const value = await producer();
  await setJson(key, value, ttlSeconds);
  return value;
}

module.exports = { getJson, setJson, rememberJson };

const crypto = require('crypto');

function generateSecret() {
  return crypto.randomBytes(32).toString('hex');
}

function hashSecret(secret) {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function signPayload(secret, payload) {
  return crypto.createHmac('sha256', secret).update(canonicalJson(payload)).digest('hex');
}

function safeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

module.exports = { generateSecret, hashSecret, canonicalJson, signPayload, safeEqual };

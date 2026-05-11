const { signPayload } = require('../src/utils/crypto');

const API = process.env.API_URL || 'http://localhost:5001';
const email = process.env.TEST_EMAIL || 'admin@workrank.local';
const password = process.env.TEST_PASSWORD || 'Admin@123456';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${options.method || 'GET'} ${path} -> ${res.status}: ${text}`);
  return body;
}

function signedPayload(secret, payload) {
  const signed = JSON.parse(JSON.stringify(payload));
  delete signed.deviceSecret;
  return { ...payload, signature: signPayload(secret, signed) };
}

async function login() {
  const body = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert(body.accessToken, 'Thiếu accessToken');
  return body.accessToken;
}

async function startSession(token, deviceUuid) {
  const body = await request('/api/activity/session/start', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ deviceUuid, deviceName: deviceUuid, platform: 'macos' }),
  });
  assert(body.session?.id, 'Thiếu session id');
  assert(body.deviceSecret, 'Thiếu deviceSecret test key');
  return { sessionId: body.session.id, deviceSecret: body.deviceSecret };
}

async function sendBatch(token, payload) {
  return request('/api/activity/batch', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}


async function expectRejected(path, token, payload, expectedStatus) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (res.status !== expectedStatus) {
    throw new Error(`${path} expected ${expectedStatus}, got ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function main() {
  console.log(`API=${API}`);
  const token = await login();
  console.log('login: OK');

  await expectRejected('/api/activity/batch', token, {
    deviceUuid: `unpaired-${Date.now()}`,
    deviceName: 'unpaired',
    platform: 'macos',
    deviceSecret: 'x'.repeat(64),
    events: [{ timestamp: new Date().toISOString(), activeSeconds: 10, idleSeconds: 0, keystrokeCount: 1, mouseClickCount: 1, mouseMoveCount: 1, sequence: 1 }],
    signature: '0'.repeat(64),
  }, 403);
  console.log('unpaired device batch: REJECTED OK');

  const deviceUuid = `anti-cheat-test-${Date.now()}`;
  const { sessionId, deviceSecret } = await startSession(token, deviceUuid);
  console.log(`test key: ${deviceSecret.slice(0, 8)}... OK`);

  const base = { deviceUuid, deviceName: deviceUuid, platform: 'macos', deviceSecret, sessionId };

  const valid = signedPayload(deviceSecret, {
    ...base,
    events: [{ timestamp: new Date().toISOString(), activeSeconds: 10, idleSeconds: 0, keystrokeCount: 12, mouseClickCount: 2, mouseMoveCount: 35, sequence: 1 }],
  });
  const validResult = await sendBatch(token, valid);
  assert(validResult.signatureValid === true, 'Valid batch phải signatureValid=true');
  assert(validResult.flaggedCount === 0, 'Valid batch không được flagged');
  console.log('valid signed batch: OK');

  const unsignedResult = await sendBatch(token, {
    ...base,
    events: [{ timestamp: new Date().toISOString(), activeSeconds: 10, idleSeconds: 0, keystrokeCount: 10, mouseClickCount: 2, mouseMoveCount: 30, sequence: 2 }],
  });
  assert(unsignedResult.signatureValid === false, 'Unsigned batch phải signatureValid=false');
  assert(unsignedResult.flaggedCount === 1, 'Unsigned batch phải bị flagged');
  console.log('unsigned/fake batch: FLAGGED OK');

  const fastClick = signedPayload(deviceSecret, {
    ...base,
    events: [{ timestamp: new Date().toISOString(), activeSeconds: 10, idleSeconds: 0, keystrokeCount: 0, mouseClickCount: 500, mouseMoveCount: 0, sequence: 3 }],
  });
  const fastResult = await sendBatch(token, fastClick);
  assert(fastResult.signatureValid === true, 'Fast click batch ký phải hợp lệ');
  assert(fastResult.flaggedCount === 1, 'Auto-click nhanh phải bị flagged');
  console.log('fast auto-click: FLAGGED OK');

  let slowFlagged = false;
  for (let sequence = 4; sequence <= 10; sequence += 1) {
    const slow = signedPayload(deviceSecret, {
      ...base,
      events: [{ timestamp: new Date().toISOString(), activeSeconds: 10, idleSeconds: 0, keystrokeCount: 0, mouseClickCount: 3, mouseMoveCount: 0, sequence }],
    });
    const slowResult = await sendBatch(token, slow);
    if (slowResult.flaggedCount > 0) slowFlagged = true;
  }
  assert(slowFlagged, 'Auto-click chậm/lặp phải bị flagged sau vài batch');
  console.log('slow repeated auto-click: FLAGGED OK');

  const anomalies = await request('/api/security/anomalies?days=1', { headers: { Authorization: `Bearer ${token}` } });
  assert(Number(anomalies.flaggedEvents) > 0, 'Security anomalies phải có flaggedEvents > 0');
  console.log(`security anomalies flaggedEvents=${anomalies.flaggedEvents}: OK`);

  const baseline = await request('/api/security/users/1/baseline?days=7', { headers: { Authorization: `Bearer ${token}` } });
  assert(Number.isFinite(Number(baseline.avgActiveSeconds)), 'Baseline API phải trả avgActiveSeconds');
  console.log('7-day baseline API: OK');

  const devices = await request('/api/security/devices?includeRevoked=true', { headers: { Authorization: `Bearer ${token}` } });
  const testDevice = devices.data.find((device) => device.deviceUuid === deviceUuid);
  assert(testDevice?.id, 'Security devices phải trả test device');
  await request(`/api/security/devices/${testDevice.id}/revoke`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  const rejectedAfterRevoke = await expectRejected('/api/activity/batch', token, signedPayload(deviceSecret, {
    ...base,
    events: [{ timestamp: new Date().toISOString(), activeSeconds: 10, idleSeconds: 0, keystrokeCount: 1, mouseClickCount: 1, mouseMoveCount: 1, sequence: 11 }],
  }), 403);
  assert(rejectedAfterRevoke.message === 'Device revoked', 'Device revoke phải chặn batch');
  await request(`/api/security/devices/${testDevice.id}/restore`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  console.log('device revoke/restore API: OK');

  const overview = await request('/api/dashboard/overview', { headers: { Authorization: `Bearer ${token}` } });
  assert(Number(overview.suspiciousEventsToday) > 0, 'Dashboard phải có suspiciousEventsToday > 0');
  console.log(`dashboard suspiciousEventsToday=${overview.suspiciousEventsToday}: OK`);
  console.log('ANTI_CHEAT_SMOKE_TEST_PASS');
}

main().catch((error) => {
  console.error('ANTI_CHEAT_SMOKE_TEST_FAIL');
  console.error(error.message);
  process.exit(1);
});

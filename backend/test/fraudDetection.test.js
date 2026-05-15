const test = require('node:test');
const assert = require('node:assert/strict');
const fraudDetection = require('../src/services/fraudDetection.service');

function baseDevice(overrides = {}) {
  return {
    lastSequence: 10,
    lastEventAt: new Date().toISOString(),
    lastClickCount: 0,
    lastActiveSeconds: 0,
    repeatedClickPatternCount: 0,
    ...overrides,
  };
}

test('sequence nhảy quá xa bị gắn cờ cảnh báo', () => {
  const result = fraudDetection.analyzeSequence({ sequence: 400 }, 10);
  assert.equal(result.ok, true);
  assert.equal(result.flag, 'large_sequence_gap');
});

test('input không có active time bị nghi vấn cao', () => {
  const analysis = fraudDetection.analyzeEvent(
    {
      timestamp: new Date().toISOString(),
      activeSeconds: 0,
      idleSeconds: 5,
      keystrokeCount: 1,
      mouseClickCount: 0,
      sequence: 11,
    },
    baseDevice({ lastEventAt: null }),
    true,
    { ok: true },
    null,
    { hasSessionId: true },
  );

  assert.ok(analysis.flags.includes('input_without_active_time'));
  assert.equal(analysis.trusted, true);
});

test('tốc độ thao tác tổng cao bị gắn cờ dù từng loại chưa vượt ngưỡng riêng', () => {
  const analysis = fraudDetection.analyzeEvent(
    {
      timestamp: new Date().toISOString(),
      activeSeconds: 5,
      idleSeconds: 0,
      keystrokeCount: 110,
      mouseClickCount: 50,
      sequence: 11,
    },
    baseDevice({ lastEventAt: null }),
    true,
    { ok: true },
    null,
    { hasSessionId: true },
  );

  assert.ok(analysis.flags.includes('high_combined_action_rate'));
  assert.equal(analysis.flags.includes('high_key_rate'), false);
  assert.equal(analysis.flags.includes('high_click_rate'), false);
});

test('event quá dài hoặc quá nhiều thao tác sẽ bị không tin cậy', () => {
  const analysis = fraudDetection.analyzeEvent(
    {
      timestamp: new Date().toISOString(),
      activeSeconds: 45,
      idleSeconds: 0,
      keystrokeCount: 420,
      mouseClickCount: 0,
      sequence: 11,
    },
    baseDevice({ lastEventAt: null }),
    true,
    { ok: true },
    null,
    { hasSessionId: true },
  );

  assert.ok(analysis.flags.includes('active_window_too_large'));
  assert.ok(analysis.flags.includes('too_many_actions_in_event'));
  assert.equal(analysis.trusted, false);
});

test('event cũ hơn event trước đó bị gắn cờ lệch thứ tự thời gian', () => {
  const lastEventAt = new Date();
  const eventTime = new Date(lastEventAt.getTime() - 30_000);
  const analysis = fraudDetection.analyzeEvent(
    {
      timestamp: eventTime.toISOString(),
      activeSeconds: 5,
      idleSeconds: 0,
      keystrokeCount: 1,
      mouseClickCount: 1,
      sequence: 11,
    },
    baseDevice({ lastEventAt: lastEventAt.toISOString() }),
    true,
    { ok: true },
    null,
    { hasSessionId: true },
  );

  assert.ok(analysis.flags.includes('event_time_out_of_order'));
});

test('gõ nhanh hợp lý không bị cảnh báo', () => {
  const analysis = fraudDetection.analyzeEvent(
    {
      timestamp: new Date().toISOString(),
      activeSeconds: 5,
      idleSeconds: 0,
      keystrokeCount: 90,
      mouseClickCount: 0,
      sequence: 11,
    },
    baseDevice({ lastEventAt: null }),
    true,
    { ok: true },
    null,
    { hasSessionId: true },
  );

  assert.deepEqual(analysis.flags, []);
  assert.equal(analysis.trusted, true);
});

test('click đều ít lần không bị coi là bot', () => {
  const lastEventAt = new Date(Date.now() - 5_000);
  const analysis = fraudDetection.analyzeEvent(
    {
      timestamp: new Date().toISOString(),
      activeSeconds: 5,
      idleSeconds: 0,
      keystrokeCount: 0,
      mouseClickCount: 1,
      sequence: 11,
    },
    baseDevice({
      lastEventAt: lastEventAt.toISOString(),
      lastClickCount: 1,
      lastActiveSeconds: 5,
      repeatedClickPatternCount: 4,
    }),
    true,
    { ok: true },
    null,
    { hasSessionId: true },
  );

  assert.equal(analysis.flags.includes('robotic_repeated_click_pattern'), false);
  assert.equal(analysis.flags.includes('repeated_click_pattern_streak'), false);
  assert.equal(analysis.trusted, true);
});

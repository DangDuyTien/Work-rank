const { signPayload, safeEqual, hashSecret } = require('../utils/crypto');

const LIMITS = {
  maxClicksPerSecond: 8,
  maxKeysPerSecond: 15,
  maxMovesPerSecond: 120,
  maxClockSkewMs: 5 * 60 * 1000,
  highSuspicionThreshold: 60,
  repeatedPatternThreshold: 4,
  clickOnlyStreakThreshold: 5,
  intervalToleranceMs: 350,
  baselineMinActiveDays: 3,
  baselineSpikeMultiplier: 4,
  quarantineHighSuspicionEvents: 5,
  quarantineWindowMs: 10 * 60 * 1000,
};

function stripSignature(payload) {
  const clone = JSON.parse(JSON.stringify(payload));
  delete clone.signature;
  delete clone.deviceSecret;
  return clone;
}

function verifyBatchSignature(device, payload) {
  if (!payload.signature) return { valid: false, flag: 'missing_signature' };
  if (!payload.deviceSecret) return { valid: false, flag: 'missing_device_secret' };
  if (device.deviceSecretHash && device.deviceSecretHash !== hashSecret(payload.deviceSecret)) {
    return { valid: false, flag: 'invalid_device_secret' };
  }
  const expected = signPayload(payload.deviceSecret, stripSignature(payload));
  return safeEqual(expected, payload.signature) ? { valid: true } : { valid: false, flag: 'invalid_signature' };
}

function isClickOnly(event) {
  return (event.mouseClickCount || 0) > 0 && (event.keystrokeCount || 0) === 0 && (event.mouseMoveCount || 0) === 0;
}

function isRepeatedPattern(event, device, eventTime) {
  if (!device.lastEventAt || device.lastClickCount === null || device.lastActiveSeconds === null) return false;
  const intervalMs = Math.abs(eventTime.getTime() - new Date(device.lastEventAt).getTime());
  const expectedMs = Number(device.lastActiveSeconds || 0) * 1000;
  const intervalStable = expectedMs > 0 && Math.abs(intervalMs - expectedMs) <= LIMITS.intervalToleranceMs;
  const clickStable = Number(device.lastClickCount || 0) === Number(event.mouseClickCount || 0);
  const durationStable = Number(device.lastActiveSeconds || 0) === Number(event.activeSeconds || 0);
  return intervalStable && clickStable && durationStable && isClickOnly(event);
}


function analyzeSequence(event, previousSequence) {
  const sequence = Number(event.sequence || 0);
  if (!sequence) return { ok: false, flag: 'missing_sequence' };
  if (sequence <= Number(previousSequence || 0)) return { ok: false, flag: 'replayed_or_old_sequence' };
  return { ok: true };
}

function analyzeEvent(event, device, signatureValid, sequenceCheck = { ok: true }, baseline = null) {
  const flags = [];
  const totalSeconds = Math.max(1, (event.activeSeconds || 0) + (event.idleSeconds || 0));
  const clickRate = (event.mouseClickCount || 0) / totalSeconds;
  const keyRate = (event.keystrokeCount || 0) / totalSeconds;
  const moveRate = (event.mouseMoveCount || 0) / totalSeconds;
  const eventTime = event.timestamp ? new Date(event.timestamp) : new Date();
  let suspicionScore = 0;

  if (!signatureValid) {
    flags.push('untrusted_signature');
    suspicionScore += 75;
  }
  if (Math.abs(Date.now() - eventTime.getTime()) > LIMITS.maxClockSkewMs) {
    flags.push('clock_skew');
    suspicionScore += 20;
  }
  if (!sequenceCheck.ok) {
    flags.push(sequenceCheck.flag);
    suspicionScore += 75;
  }
  if (clickRate > LIMITS.maxClicksPerSecond) {
    flags.push('high_click_rate');
    suspicionScore += 35;
  }
  if (keyRate > LIMITS.maxKeysPerSecond) {
    flags.push('high_key_rate');
    suspicionScore += 35;
  }
  if (moveRate > LIMITS.maxMovesPerSecond) {
    flags.push('high_mouse_move_rate');
    suspicionScore += 20;
  }
  if ((event.mouseClickCount || 0) >= 30 && (event.mouseMoveCount || 0) === 0) {
    flags.push('clicks_without_mouse_movement');
    suspicionScore += 30;
  }
  if (isClickOnly(event)) {
    flags.push('click_only_event');
    suspicionScore += 15;
  }
  if ((event.activeSeconds || 0) > 0 && (event.keystrokeCount || 0) === 0 && (event.mouseClickCount || 0) === 0 && (event.mouseMoveCount || 0) === 0) {
    flags.push('active_without_input');
    suspicionScore += 15;
  }
  if (isRepeatedPattern(event, device, eventTime)) {
    flags.push('robotic_repeated_click_pattern');
    suspicionScore += 35;
  }
  if (Number(device.repeatedClickPatternCount || 0) >= LIMITS.repeatedPatternThreshold) {
    flags.push('repeated_click_pattern_streak');
    suspicionScore += 40;
  }
  if (Number(device.clickOnlyStreakCount || 0) >= LIMITS.clickOnlyStreakThreshold) {
    flags.push('click_only_streak');
    suspicionScore += 50;
  }
  if (baseline && baseline.activeDays >= LIMITS.baselineMinActiveDays) {
    const baselineClickRate = baseline.avgClicksPerActiveSecond || 0;
    const baselineKeyRate = baseline.avgKeysPerActiveSecond || 0;
    if (baselineClickRate > 0 && clickRate > baselineClickRate * LIMITS.baselineSpikeMultiplier && (event.mouseClickCount || 0) >= 10) {
      flags.push('baseline_click_rate_spike');
      suspicionScore += 25;
    }
    if (baselineKeyRate > 0 && keyRate > baselineKeyRate * LIMITS.baselineSpikeMultiplier && (event.keystrokeCount || 0) >= 20) {
      flags.push('baseline_key_rate_spike');
      suspicionScore += 25;
    }
  }

  return { flags, suspicionScore: Math.min(100, suspicionScore), trusted: suspicionScore < LIMITS.highSuspicionThreshold };
}

function nextPatternState(device, originalEvent) {
  const eventTime = originalEvent.timestamp ? new Date(originalEvent.timestamp) : new Date();
  const repeated = isRepeatedPattern(originalEvent, device, eventTime);
  const clickOnly = isClickOnly(originalEvent);
  return {
    lastEventAt: eventTime,
    lastClickCount: originalEvent.mouseClickCount || 0,
    lastActiveSeconds: originalEvent.activeSeconds || 0,
    repeatedClickPatternCount: repeated ? Number(device.repeatedClickPatternCount || 0) + 1 : 0,
    clickOnlyStreakCount: clickOnly ? Number(device.clickOnlyStreakCount || 0) + 1 : 0,
  };
}

function applyTrustPenalty(event, analysis) {
  if (analysis.trusted) return event;
  return {
    ...event,
    activeSeconds: 0,
    idleSeconds: event.idleSeconds || 0,
    keystrokeCount: 0,
    mouseClickCount: 0,
    mouseMoveCount: 0,
  };
}

module.exports = { verifyBatchSignature, analyzeSequence, analyzeEvent, nextPatternState, applyTrustPenalty, LIMITS };

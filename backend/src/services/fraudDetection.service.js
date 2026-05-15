const { signPayload, safeEqual, hashSecret } = require('../utils/crypto');

const LIMITS = {
  maxClicksPerSecond: 12,
  maxKeysPerSecond: 22,
  maxCombinedActionsPerSecond: 30,
  maxActionsPerEvent: 360,
  maxActiveSecondsPerEvent: 30,
  maxIdleSecondsPerEvent: 600,
  maxSequenceGap: 300,
  maxClockSkewMs: 5 * 60 * 1000,
  maxEventBacktrackMs: 10 * 1000,
  highSuspicionThreshold: 60,
  minClicksForRepeatedPattern: 8,
  repeatedPatternThreshold: 4,
  intervalToleranceMs: 350,
  baselineMinActiveDays: 5,
  baselineSpikeMultiplier: 6,
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

function numberValue(value) {
  return Math.max(0, Number(value || 0));
}

function isClickOnly(event) {
  return (event.mouseClickCount || 0) > 0 && (event.keystrokeCount || 0) === 0;
}

function isRepeatedPattern(event, device, eventTime) {
  if (!device.lastEventAt || device.lastClickCount === null || device.lastActiveSeconds === null) return false;
  if (Number(event.mouseClickCount || 0) < LIMITS.minClicksForRepeatedPattern) return false;
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
  const gap = sequence - Number(previousSequence || 0);
  if (gap > LIMITS.maxSequenceGap) return { ok: true, flag: 'large_sequence_gap', gap };
  return { ok: true };
}

function analyzeEvent(event, device, signatureValid, sequenceCheck = { ok: true }, baseline = null, context = {}) {
  const flags = [];
  const activeSeconds = numberValue(event.activeSeconds);
  const idleSeconds = numberValue(event.idleSeconds);
  const keystrokeCount = numberValue(event.keystrokeCount);
  const mouseClickCount = numberValue(event.mouseClickCount);
  const totalSeconds = Math.max(1, activeSeconds + idleSeconds);
  const actionWindowSeconds = Math.max(1, activeSeconds || totalSeconds);
  const actionCount = keystrokeCount + mouseClickCount;
  const clickRate = mouseClickCount / actionWindowSeconds;
  const keyRate = keystrokeCount / actionWindowSeconds;
  const combinedActionRate = actionCount / actionWindowSeconds;
  const eventTime = event.timestamp ? new Date(event.timestamp) : new Date();
  const lastEventAt = device.lastEventAt ? new Date(device.lastEventAt) : null;
  const repeatedPattern = isRepeatedPattern(event, device, eventTime);
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
  } else if (sequenceCheck.flag) {
    flags.push(sequenceCheck.flag);
    suspicionScore += 20;
  }
  if (!context.hasSessionId) {
    flags.push('missing_session');
    suspicionScore += 30;
  }
  if (lastEventAt && eventTime.getTime() < lastEventAt.getTime() - LIMITS.maxEventBacktrackMs) {
    flags.push('event_time_out_of_order');
    suspicionScore += 40;
  }
  if (clickRate > LIMITS.maxClicksPerSecond) {
    flags.push('high_click_rate');
    suspicionScore += 35;
  }
  if (keyRate > LIMITS.maxKeysPerSecond) {
    flags.push('high_key_rate');
    suspicionScore += 35;
  }
  if (combinedActionRate > LIMITS.maxCombinedActionsPerSecond) {
    flags.push('high_combined_action_rate');
    suspicionScore += 40;
  }
  if (actionCount > LIMITS.maxActionsPerEvent) {
    flags.push('too_many_actions_in_event');
    suspicionScore += 45;
  }
  if (activeSeconds > LIMITS.maxActiveSecondsPerEvent) {
    flags.push('active_window_too_large');
    suspicionScore += 30;
  }
  if (idleSeconds > LIMITS.maxIdleSecondsPerEvent) {
    flags.push('idle_window_too_large');
    suspicionScore += 20;
  }
  if (actionCount > 0 && activeSeconds === 0) {
    flags.push('input_without_active_time');
    suspicionScore += 45;
  }
  if (activeSeconds > 0 && keystrokeCount === 0 && mouseClickCount === 0) {
    flags.push('active_without_input');
    suspicionScore += 15;
  }
  if (repeatedPattern) {
    flags.push('robotic_repeated_click_pattern');
    suspicionScore += 35;
  }
  if (repeatedPattern && Number(device.repeatedClickPatternCount || 0) >= LIMITS.repeatedPatternThreshold) {
    flags.push('repeated_click_pattern_streak');
    suspicionScore += 40;
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

'use strict';
const engine = require('./typingEngine');
const METRIC_VERSION = 2;
const chars = (value) => Array.from(String(value ?? '').normalize('NFC'));
function measureInput(challenge, text, durationMs, difficulty = 'MEDIUM') {
  const target = chars(challenge);
  const input = chars(text);
  const compared = input.slice(0, target.length);
  let errorCount = 0;
  for (let i = 0; i < compared.length; i++) {
    if (compared[i].toLocaleLowerCase() !== target[i].toLocaleLowerCase()) errorCount++;
  }
  const validation = engine.validateSubmissionPlausibility({ challengeLength: target.length, typedChars: input.length, errorCount, durationMs });
  const accuracy = engine.calculateAccuracy(compared.length, errorCount);
  const progressPct = target.length ? Math.min(100, compared.length / target.length * 100) : 0;
  const completed = target.length > 0 && compared.length >= Math.ceil(target.length * 0.9);
  const eligible = validation.valid && compared.length >= 20;
  const performanceScore = eligible ? engine.computeBasePerformanceScore({ wpm: validation.wpm, accuracy, errorCount, completed, difficulty }) : 0;
  return { metricVersion: METRIC_VERSION, text: compared.join(''), typedChars: compared.length, correctChars: compared.length - errorCount, errorCount, currentIncorrectChars: errorCount, accuracy, progressPct: Math.round(progressPct * 10) / 10, rawWpm: engine.calculateWPM(input.length, durationMs), wpm: validation.valid ? validation.wpm : 0, completed, validSubmission: validation.valid, eligible: eligible && performanceScore > 0, performanceScore, completionTimeMs: Math.max(0, Number(durationMs) || 0), invalidReason: validation.valid ? null : validation.reason };
}
module.exports = { METRIC_VERSION, chars, measureInput };

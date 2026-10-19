'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { chars, normalizeText, measureInput, foldCase } = require('../src/services/typingMetrics');

test('typing Unicode semantics', async (t) => {
  await t.test('NFC/NFD Vietnamese are equivalent and normalized output is NFC', () => {
    const nfd = 'a\u0301';
    assert.equal(normalizeText(nfd), 'á');
    const m = measureInput('á', nfd, 60000);
    assert.equal(m.typedChars, 1);
    assert.equal(m.errorCount, 0);
    assert.equal(m.text, 'á');
  });
  await t.test('grapheme clusters count as one typing position', () => {
    assert.equal(chars('👨‍👩‍👧‍👦').length, 1);
    assert.equal(chars('👍🏽').length, 1);
    assert.equal(chars('🇻🇳').length, 1);
    const m = measureInput('👨‍👩‍👧‍👦!', '👨‍👩‍👧‍👦!', 60000);
    assert.equal(m.typedChars, 2);
    assert.equal(m.errorCount, 0);
  });
  await t.test('punctuation and whitespace remain strict positional characters', () => {
    const exact = measureInput('a,  b', 'a,  b', 60000);
    const altered = measureInput('a,  b', 'a b', 60000);
    assert.equal(exact.errorCount, 0);
    assert.equal(altered.errorCount, 2);
    assert.equal(measureInput('a\u00a0b', 'a b', 60000).errorCount, 1);
  });
  await t.test('case policy is deterministic and case-insensitive', () => {
    assert.equal(foldCase('A'), foldCase('a'));
    assert.equal(measureInput('Việt', 'VIỆT', 60000).errorCount, 0);
  });
  await t.test('NFC normalization occurs before challenge boundary validation', () => {
    const m = measureInput('á', 'a\u0301', 60000);
    assert.equal(m.validSubmission, true);
    assert.equal(m.typedChars, 1);
  });
});

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isAllowedOrigin } = require('../src/utils/corsOptions');

describe('CORS Security Configuration Test Suite', () => {
  const prodOptions = {
    nodeEnv: 'production',
    configuredOrigins: ['https://workrank.io', 'https://app.workrank.io'],
  };

  const devOptions = {
    nodeEnv: 'development',
    configuredOrigins: ['https://workrank.io'],
  };

  it('1. Allows non-browser requests with no origin header (curl, mobile, s2s)', () => {
    assert.equal(isAllowedOrigin(undefined, prodOptions), true);
    assert.equal(isAllowedOrigin(null, prodOptions), true);
    assert.equal(isAllowedOrigin('', prodOptions), true);
  });

  it('2. Allows explicitly configured origins in production', () => {
    assert.equal(isAllowedOrigin('https://workrank.io', prodOptions), true);
    assert.equal(isAllowedOrigin('https://app.workrank.io', prodOptions), true);
  });

  it('3. Rejects localhost & 127.0.0.1 in production', () => {
    assert.equal(isAllowedOrigin('http://localhost:5173', prodOptions), false);
    assert.equal(isAllowedOrigin('http://localhost:3000', prodOptions), false);
    assert.equal(isAllowedOrigin('http://127.0.0.1:5173', prodOptions), false);
  });

  it('4. Rejects arbitrary onrender.com domains in production', () => {
    assert.equal(isAllowedOrigin('https://attacker-app.onrender.com', prodOptions), false);
    assert.equal(isAllowedOrigin('https://evil.onrender.com', prodOptions), false);
  });

  it('5. Allows localhost & 127.0.0.1 in development/test', () => {
    assert.equal(isAllowedOrigin('http://localhost:5173', devOptions), true);
    assert.equal(isAllowedOrigin('http://localhost:3000', devOptions), true);
    assert.equal(isAllowedOrigin('http://127.0.0.1:5173', devOptions), true);
    assert.equal(isAllowedOrigin('http://127.0.0.1:3000', devOptions), true);
  });

  it('6. Rejects random malicious origins in development', () => {
    assert.equal(isAllowedOrigin('https://attacker.com', devOptions), false);
    assert.equal(isAllowedOrigin('https://phishing-site.xyz', devOptions), false);
  });
});

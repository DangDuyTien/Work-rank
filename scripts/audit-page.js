const { chromium } = require('../frontend/node_modules/playwright');
const { User } = require('../backend/src/models');
const authService = require('../backend/src/services/auth.service');
const path = require('path');
const fs = require('fs');

async function auditRoute(route, options = {}) {
  const { asUser = true, viewports = [1440, 768, 390], testInteraction } = options;
  let tokens = null;
  if (asUser) {
    const admin = await User.findByPk(1);
    tokens = await authService.issueTokens(admin);
  }

  const browser = await chromium.launch({ headless: true });
  const results = {};

  for (const width of viewports) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : width === 768 ? 1024 : 900 },
      isMobile: width < 600,
    });

    if (tokens) {
      await context.addInitScript(({ token, refreshToken, user }) => {
        localStorage.setItem('token', token);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('workrank_active_user_id', String(user.id));
        localStorage.setItem('workrank_session', JSON.stringify({ userId: String(user.id), token, sessionGeneration: Date.now() }));
      }, { token: tokens.accessToken, refreshToken: tokens.refreshToken, user: tokens.user });
    }

    const page = await context.newPage();
    const consoleLogs = [];
    const consoleErrors = [];
    const failedRequests = [];

    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push({ type: msg.type(), text });
      if (msg.type() === 'error') consoleErrors.push(text);
    });
    page.on('pageerror', err => consoleErrors.push('PAGE_ERROR: ' + err.message));
    page.on('requestfailed', req => failedRequests.push({ url: req.url(), failure: req.failure()?.errorText }));
    page.on('response', res => {
      if (res.status() >= 400 && !res.url().includes('favicon')) {
        failedRequests.push({ url: res.url(), status: res.status() });
      }
    });

    const targetUrl = `http://localhost:5173${route}`;
    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 15000 }).catch(e => consoleErrors.push('NAV_ERROR: ' + e.message));
    await page.waitForTimeout(600);

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });

    const overflowElements = await page.evaluate(() => {
      const elements = [];
      const docWidth = window.innerWidth;
      const all = document.querySelectorAll('*');
      for (const el of all) {
        const rect = el.getBoundingClientRect();
        if (rect.right > docWidth + 2) {
          const tag = el.tagName.toLowerCase();
          const cls = el.className ? `.${String(el.className).split(' ').slice(0, 2).join('.')}` : '';
          const id = el.id ? `#${el.id}` : '';
          elements.push(`${tag}${id}${cls} (right: ${Math.round(rect.right)}, win: ${docWidth})`);
        }
      }
      return elements.slice(0, 5);
    });

    const badDataFound = await page.evaluate(() => {
      const text = document.body.innerText || '';
      const issues = [];
      if (/\bNaN\b/.test(text)) issues.push('Found NaN');
      if (/\bundefined\b/.test(text)) issues.push('Found undefined');
      if (/\bnull\b/.test(text)) issues.push('Found null');
      if (/\bInfinity\b/.test(text)) issues.push('Found Infinity');
      if (/Invalid Date/i.test(text)) issues.push('Found Invalid Date');
      if (/\[object Object\]/.test(text)) issues.push('Found [object Object]');
      return issues;
    });

    let interactionResult = null;
    if (testInteraction) {
      try {
        interactionResult = await testInteraction(page);
      } catch (e) {
        interactionResult = { error: e.message };
      }
    }

    const cleanRouteName = route.replace(/\//g, '_').replace(/^_/, '') || 'home';
    const screenshotPath = path.resolve(__dirname, `../../docs/audit/2026-10-24/screenshots/${cleanRouteName}_${width}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    results[`vp_${width}`] = {
      width,
      url: page.url(),
      hasHorizontalOverflow,
      overflowElements,
      badDataFound,
      consoleErrors,
      failedRequests,
      interactionResult,
      screenshot: screenshotPath,
    };

    await context.close();
  }

  await browser.close();
  return results;
}

module.exports = { auditRoute };

if (require.main === module) {
  const route = process.argv[2] || '/';
  const asUser = process.argv[3] !== 'anon';
  auditRoute(route, { asUser }).then(res => {
    console.log(JSON.stringify(res, null, 2));
  }).catch(console.error);
}

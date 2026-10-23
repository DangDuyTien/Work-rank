import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * QA GÕ NHANH — tiếng Việt có dấu / IME / Unicode.
 *
 * Nguyên tắc: browser là nguồn chữ. Script chỉ mô phỏng các cách native input
 * có thể biến đổi: key events, insertText, NFD, composition (CDP), keyboard-hook
 * (UniKey kiểu gõ nguyên âm gốc rồi thay dấu). Không gọi đây là "UniKey OS thật".
 */

const web = process.env.QA_WEB || 'http://127.0.0.1:5277';
const api = process.env.QA_API || 'http://127.0.0.1:5001';
const out = path.resolve(process.env.QA_OUT || '../docs/audit/2026-10-23/go-nhanh-vietnamese');
const PASSWORD = 'GoNhanhTest123!';
const ACCOUNTS = [
  { email: 'qa-ime-1@workrank.test', name: 'QA Gõ Nhanh 1' },
  { email: 'qa-ime-2@workrank.test', name: 'QA Gõ Nhanh 2' },
  { email: 'qa-ime-3@workrank.test', name: 'QA Gõ Nhanh 3' },
  { email: 'qa-ime-4@workrank.test', name: 'QA Gõ Nhanh 4' },
];

await fs.mkdir(out, { recursive: true });

const browser = await chromium.launch({ headless: true });
const report = { checks: [], errors: [], shots: [], scenarios: {}, startedAt: new Date().toISOString() };
const pass = (name, evidence = '') => { report.checks.push({ name, status: 'PASS', evidence }); console.log('PASS', name, evidence ? `· ${evidence}` : ''); };
const fail = (name, evidence = '') => { report.checks.push({ name, status: 'FAIL', evidence }); console.log('FAIL', name, evidence ? `· ${evidence}` : ''); };
async function shot(page, name) { const file = path.join(out, `${name}.png`); await page.screenshot({ path: file }); report.shots.push(path.basename(file)); console.log('SHOT', name); }

async function auth(email, name) {
  const request = await browser.newContext();
  let response = await request.request.post(`${api}/api/auth/login`, { data: { email, password: PASSWORD } });
  if (!response.ok()) {
    response = await request.request.post(`${api}/api/auth/register`, { data: { name, email, password: PASSWORD } });
    if (!response.ok()) throw new Error(`auth ${email}: ${response.status()} ${await response.text()}`);
  }
  const body = await response.json();
  await request.close();
  return body;
}

async function session(account, viewport = { width: 1440, height: 1000 }) {
  const body = await auth(account.email, account.name);
  const context = await browser.newContext({ viewport });
  await context.addInitScript(({ token, refresh }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refresh);
  }, { token: body.accessToken, refresh: body.refreshToken });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push(`${account.email}: ${error.message}`));
  const headers = { Authorization: `Bearer ${body.accessToken}` };
  return { context, page, headers, email: account.email };
}

async function cleanup(client) {
  const active = await client.context.request.get(`${api}/api/games/arcade/active`, { headers: client.headers });
  const body = await active.json().catch(() => null);
  if (!body?.room?.id) return;
  await client.context.request.post(`${api}/api/games/arcade/rooms/${body.room.id}/finish`, { headers: client.headers, data: { events: [] } }).catch(() => {});
  await client.context.request.post(`${api}/api/games/arcade/rooms/${body.room.id}/leave`, { headers: client.headers, data: {} }).catch(() => {});
}

async function createRoom(client, { mode = 'SOLO', difficulty = 'vietnamese' } = {}) {
  await cleanup(client);
  const created = await client.context.request.post(`${api}/api/games/arcade/rooms`, {
    headers: client.headers,
    data: { gameType: 'computer_rush', mode, difficulty, matchType: 'RANKED', language: 'VI' },
  });
  if (!created.ok()) throw new Error(`create ${created.status()} ${await created.text()}`);
  const room = (await created.json()).room;
  if (mode === 'SOLO') return room;
  return room;
}

async function openRoom(client, room) {
  await client.page.goto(`${web}/games/typing/words/room/${room.id}`, { waitUntil: 'networkidle' });
  await client.page.waitForSelector('[data-testid="challenge-word"]', { timeout: 15000 });
  await client.page.waitForTimeout(3700);
  await client.page.locator('#arcade-word-input').focus();
}

async function state(client) {
  return client.page.evaluate(() => {
    const word = document.querySelector('[data-testid="challenge-word"]');
    const input = document.querySelector('#arcade-word-input');
    const monitor = document.querySelector('.arcade-monitor');
    const turn = document.querySelector('.arcade-monitor-top span')?.textContent || '';
    return {
      word: word?.getAttribute('aria-label'),
      input: input?.value,
      wrong: monitor?.classList.contains('typing-error'),
      wrongChars: document.querySelectorAll('[data-char-state="wrong"]').length,
      turn: Number((turn.match(/\d+/) || [0])[0]),
      active: document.activeElement?.id,
      composing: monitor?.getAttribute('data-composing'),
    };
  });
}

async function waitTurn(client, turn, timeout = 3000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const s = await state(client);
    if (s.turn !== turn) return s;
    await client.page.waitForTimeout(30);
  }
  return state(client);
}

async function typeWord(client, word, delay = 8) {
  await client.page.locator('#arcade-word-input').focus();
  await client.page.keyboard.type(word.toLocaleLowerCase('vi'), { delay });
}

async function advanceToDiacritic(client, max = 15) {
  for (let i = 0; i < max; i++) {
    const s = await state(client);
    if (/[^\u0000-\u007F]/u.test(s.word || '')) return s.word;
    await typeWord(client, s.word || '');
    await waitTurn(client, s.turn);
  }
  throw new Error('không gặp từ có dấu');
}

const DIACRITIC = /[^\u0000-\u007F]/u;

try {
  /* ── S1. 30 challenge, >=15 tiếng Việt có dấu ── */
  const solo = await session(ACCOUNTS[0]);
  const room = await createRoom(solo, { mode: 'SOLO', difficulty: 'vietnamese' });
  await openRoom(solo, room);

  const run = { total: 0, vietnamese: 0, failures: [], doubleJumps: 0, focusLoss: 0, wrongFlash: 0, turns: [] };
  for (let i = 0; i < 30; i++) {
    const before = await state(solo);
    if (!before.word) break;
    run.total += 1;
    if (DIACRITIC.test(before.word)) run.vietnamese += 1;
    if (before.wrong) run.wrongFlash += 1;
    if (before.active !== 'arcade-word-input') run.focusLoss += 1;
    await typeWord(solo, before.word, 6);
    const after = await waitTurn(solo, before.turn, 2500);
    const delta = after.turn - before.turn;
    if (delta !== 1) run.failures.push({ index: i, word: before.word, delta, input: after.input });
    if (delta > 1) run.doubleJumps += 1;
    if (after.active !== 'arcade-word-input') run.focusLoss += 1;
    run.turns.push({ word: before.word, delta, ms: 0 });
    if (i === 12) await shot(solo.page, '01-solo-30-run');
  }
  report.scenarios.solo30 = run;
  if (run.total >= 30) pass('Chơi đủ 30 challenge', `${run.total}`); else fail('Chơi đủ 30 challenge', `${run.total}`);
  if (run.vietnamese >= 15) pass('≥15 challenge tiếng Việt có dấu', `${run.vietnamese}/30`); else fail('≥15 challenge tiếng Việt có dấu', `${run.vietnamese}/30`);
  if (run.failures.length === 0) pass('30/30 từ hoàn thành, không kẹt', JSON.stringify(run.failures.slice(0, 3))); else fail('30/30 từ hoàn thành, không kẹt', JSON.stringify(run.failures.slice(0, 5)));
  if (run.doubleJumps === 0) pass('Không double-complete (mỗi từ +1 lượt)'); else fail('Không double-complete', `${run.doubleJumps}`);
  if (run.focusLoss === 0) pass('Focus giữ nguyên qua 30 lượt'); else fail('Focus giữ nguyên qua 30 lượt', `${run.focusLoss}`);
  await shot(solo.page, '02-solo-30-end');

  /* ── S2. Backspace recovery ── */
  const back = await session(ACCOUNTS[0]);
  await openRoom(back, await createRoom(back, { difficulty: 'vietnamese' }));
  const backWord = await advanceToDiacritic(back);
  const backBefore = await state(back);
  await typeWord(back, backWord);
  await back.page.keyboard.type('X');
  await back.page.waitForTimeout(650);
  const broken = await state(back);
  await back.page.keyboard.press('Backspace');
  await back.page.waitForTimeout(150);
  const repaired = await state(back);
  const backAfter = await waitTurn(back, backBefore.turn, 2000);
  report.scenarios.backspace = { word: backWord, brokenWrong: broken.wrong, repairedWrong: repaired.wrong, turn: backAfter.turn - backBefore.turn };
  if (broken.wrong && !repaired.wrong) pass('Backspace xoá lỗi, trạng thái về hợp lệ', backWord);
  else fail('Backspace xoá lỗi, trạng thái về hợp lệ', JSON.stringify(report.scenarios.backspace));
  if (backAfter.turn - backBefore.turn === 1) pass('Backspace rồi hoàn thành từ đúng một lần'); else fail('Backspace rồi hoàn thành từ', `${backAfter.turn - backBefore.turn}`);

  /* ── S3. NFD input ── */
  const nfd = await session(ACCOUNTS[0]);
  await openRoom(nfd, await createRoom(nfd, { difficulty: 'vietnamese' }));
  const nfdWord = await advanceToDiacritic(nfd);
  const nfdBefore = await state(nfd);
  await nfd.page.locator('#arcade-word-input').focus();
  await nfd.page.keyboard.insertText(nfdWord.normalize('NFD'));
  const nfdAfter = await waitTurn(nfd, nfdBefore.turn, 2000);
  if (nfdAfter.turn - nfdBefore.turn === 1) pass('NFD input hoàn thành từ NFC', nfdWord); else fail('NFD input hoàn thành từ NFC', nfdWord);

  /* ── S4. Composition lifecycle (CDP IME) ── */
  const comp = await session(ACCOUNTS[0]);
  await openRoom(comp, await createRoom(comp, { difficulty: 'vietnamese' }));
  const compWord = await advanceToDiacritic(comp);
  const compBefore = await state(comp);
  const cdp = await comp.context.newCDPSession(comp.page);
  const chars = Array.from(compWord.toLocaleLowerCase('vi'));
  await cdp.send('Input.imeSetComposition', { text: '', selectionStart: 0, selectionEnd: 0 });
  for (let i = 1; i <= chars.length; i++) {
    const partial = chars.slice(0, i).join('');
    await cdp.send('Input.imeSetComposition', { text: partial, selectionStart: partial.length, selectionEnd: partial.length });
    await comp.page.waitForTimeout(20);
  }
  await cdp.send('Input.insertText', { text: compWord.toLocaleLowerCase('vi') });
  const compAfter = await waitTurn(comp, compBefore.turn, 2000);
  if (compAfter.turn - compBefore.turn === 1) pass('Composition start/update/end hoàn thành từ', compWord); else fail('Composition lifecycle', compWord);

  /* ── S5. Keyboard-hook IME (UniKey không composition) ── */
  const hook = await session(ACCOUNTS[0]);
  await openRoom(hook, await createRoom(hook, { difficulty: 'vietnamese' }));
  const hookWord = await advanceToDiacritic(hook);
  const hookBefore = await state(hook);
  const steps = [];
  let current = '';
  for (const char of Array.from(hookWord.toLocaleLowerCase('vi'))) {
    const base = char.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
    if (base !== char) {
      current += base; steps.push(current);
      current = `${current.slice(0, -base.length)}${char}`; steps.push(current);
    } else { current += char; steps.push(current); }
  }
  let falseRed = 0;
  for (const step of [...new Set(steps)]) {
    await hook.page.evaluate((value) => {
      const input = document.querySelector('#arcade-word-input');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, step);
    await hook.page.waitForTimeout(45);
    const s = await state(hook);
    if (s.wrong || s.wrongChars > 0) falseRed += 1;
  }
  const hookAfter = await waitTurn(hook, hookBefore.turn, 2500);
  report.scenarios.keyboardHook = { word: hookWord, steps: steps.length, falseRed, delta: hookAfter.turn - hookBefore.turn };
  if (falseRed === 0) pass('Trạng thái trung gian Telex không bị báo đỏ', `${steps.length} bước`);
  else fail('Trạng thái trung gian Telex không bị báo đỏ', `${falseRed}/${steps.length}`);
  if (hookAfter.turn - hookBefore.turn === 1) pass('Keyboard-hook IME hoàn thành từ', hookWord); else fail('Keyboard-hook IME hoàn thành từ', hookWord);

  /* ── S6. Mixed English → Vietnamese trong cùng trận ── */
  const mixed = await session(ACCOUNTS[0]);
  await openRoom(mixed, await createRoom(mixed, { difficulty: 'mixed' }));
  let mixedOk = 0, mixedFail = 0, sawEn = 0, sawVi = 0;
  for (let i = 0; i < 20; i++) {
    const before = await state(mixed);
    if (!before.word) break;
    if (DIACRITIC.test(before.word)) sawVi += 1; else sawEn += 1;
    await typeWord(mixed, before.word, 6);
    const after = await waitTurn(mixed, before.turn, 2500);
    if (after.turn - before.turn === 1) mixedOk += 1; else mixedFail += 1;
  }
  report.scenarios.mixed = { mixedOk, mixedFail, sawEn, sawVi };
  if (mixedFail === 0 && sawEn > 0 && sawVi > 0) pass('Chuyển Anh ↔ Việt trong cùng trận', `${sawEn} EN · ${sawVi} VI`);
  else fail('Chuyển Anh ↔ Việt trong cùng trận', JSON.stringify(report.scenarios.mixed));

  /* ── S7. Double completion guard ── */
  const dbl = await session(ACCOUNTS[0]);
  await openRoom(dbl, await createRoom(dbl, { difficulty: 'vietnamese' }));
  const dblWord = await advanceToDiacritic(dbl);
  const dblBefore = await state(dbl);
  await dbl.page.locator('#arcade-word-input').focus();
  await dbl.page.keyboard.type(dblWord.toLocaleLowerCase('vi'), { delay: 4 });
  await dbl.page.evaluate((value) => {
    const input = document.querySelector('#arcade-word-input');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    for (let i = 0; i < 3; i++) {
      setter.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, dblWord.toLocaleLowerCase('vi'));
  const dblAfter = await waitTurn(dbl, dblBefore.turn, 2500);
  if (dblAfter.turn - dblBefore.turn === 1) pass('3 input event trùng chỉ complete 1 lần', `${dblBefore.turn} → ${dblAfter.turn}`); else fail('Double completion guard', `${dblBefore.turn} → ${dblAfter.turn}`);

  /* ── S8. Multiplayer: cùng chuỗi, cùng tiếng Việt ── */
  async function runMultiplayer(mode, accounts, words = 6) {
    const clients = [];
    for (const account of accounts) clients.push(await session(account));
    const [host, ...guests] = clients;
    await cleanup(host);
    const created = await host.context.request.post(`${api}/api/games/arcade/rooms`, {
      headers: host.headers,
      data: { gameType: 'computer_rush', mode, difficulty: 'vietnamese', matchType: 'RANKED', language: 'VI' },
    });
    if (!created.ok()) throw new Error(`create ${mode}: ${created.status()} ${await created.text()}`);
    const room = (await created.json()).room;
    for (const guest of guests) {
      const joined = await guest.context.request.post(`${api}/api/games/arcade/rooms/${room.id}/join`, { headers: guest.headers, data: {} });
      if (!joined.ok()) throw new Error(`join ${mode}: ${joined.status()} ${await joined.text()}`);
    }
    for (const client of clients) {
      const ready = await client.context.request.post(`${api}/api/games/arcade/rooms/${room.id}/ready`, { headers: client.headers, data: { ready: true } });
      if (!ready.ok()) throw new Error(`ready ${mode}: ${ready.status()} ${await ready.text()}`);
    }
    const started = await host.context.request.post(`${api}/api/games/arcade/rooms/${room.id}/start`, { headers: host.headers, data: {} });
    if (!started.ok()) throw new Error(`start ${mode}: ${started.status()} ${await started.text()}`);

    await Promise.all(clients.map((client) => client.page.goto(`${web}/games/typing/words/room/${room.id}`, { waitUntil: 'networkidle' })));
    await Promise.all(clients.map((client) => client.page.waitForSelector('[data-testid="challenge-word"]', { timeout: 15000 })));
    await host.page.waitForTimeout(3800);
    await Promise.all(clients.map((client) => client.page.locator('#arcade-word-input').focus()));

    let sameTarget = 0, completed = 0, mismatch = 0;
    for (let i = 0; i < words; i++) {
      const states = await Promise.all(clients.map(state));
      const target = states[0].word;
      if (!target) break;
      if (states.every((s) => s.word === target)) sameTarget += 1; else mismatch += 1;
      await Promise.all(clients.map((client) => typeWord(client, target, 6)));
      const after = await Promise.all(clients.map((client, index) => waitTurn(client, states[index].turn, 3000)));
      if (after.every((s, index) => s.turn - states[index].turn === 1)) completed += 1;
    }

    await host.page.waitForTimeout(2200);
    const snapResponse = await host.context.request.get(`${api}/api/games/arcade/rooms/${room.id}`, { headers: host.headers });
    const snapshot = await snapResponse.json();
    const metrics = snapshot.players.map((player) => ({ name: player.name, correct: player.metrics.correct, attempts: player.metrics.attempts, score: player.metrics.score }));
    const parity = metrics.every((m) => m.correct === completed && m.attempts === completed);

    if (sameTarget === words && mismatch === 0) pass(`${mode}: mọi người cùng chuỗi từ`, `${sameTarget}/${words}`);
    else fail(`${mode}: mọi người cùng chuỗi từ`, `${sameTarget}/${words}`);
    if (completed === words) pass(`${mode}: mọi người hoàn thành tiếng Việt giống nhau`, `${completed}/${words}`);
    else fail(`${mode}: mọi người hoàn thành tiếng Việt giống nhau`, `${completed}/${words}`);
    if (parity) pass(`${mode}: server chấm đúng cho cả phòng`, JSON.stringify(metrics)); else fail(`${mode}: server chấm đúng cho cả phòng`, JSON.stringify(metrics));
    await shot(host.page, `03-${mode.toLowerCase()}-multiplayer`);

    for (const client of clients) await cleanup(client);
    for (const client of clients) await client.context.close();
  }

  /* ── S10. Composition không bao giờ end (IME treo) → watchdog cứu ── */
  const stuck = await session(ACCOUNTS[0]);
  await openRoom(stuck, await createRoom(stuck, { difficulty: 'vietnamese' }));
  const stuckWord = await advanceToDiacritic(stuck);
  const stuckBefore = await state(stuck);
  const stuckCdp = await stuck.context.newCDPSession(stuck.page);
  const stuckValue = stuckWord.toLocaleLowerCase('vi');
  await stuckCdp.send('Input.imeSetComposition', { text: stuckValue, selectionStart: stuckValue.length, selectionEnd: stuckValue.length });
  await stuck.page.waitForTimeout(1700);
  const stuckAfter = await waitTurn(stuck, stuckBefore.turn, 2000);
  report.scenarios.stuckComposition = { word: stuckWord, delta: stuckAfter.turn - stuckBefore.turn, active: stuckAfter.active };
  if (stuckAfter.turn - stuckBefore.turn === 1) pass('Composition treo vẫn finalize (watchdog)', stuckWord); else fail('Composition treo vẫn finalize (watchdog)', JSON.stringify(report.scenarios.stuckComposition));
  if (stuckAfter.active === 'arcade-word-input') pass('Watchdog trả focus về input'); else fail('Watchdog trả focus về input', stuckAfter.active);
  await stuck.context.close();

  /* ── S9. English regression ── */
  const english = await session(ACCOUNTS[0]);
  await openRoom(english, await createRoom(english, { difficulty: 'easy' }));
  let englishOk = 0, englishFail = 0;
  for (let i = 0; i < 10; i++) {
    const before = await state(english);
    if (!before.word) break;
    await typeWord(english, before.word, 5);
    const after = await waitTurn(english, before.turn, 2500);
    if (after.turn - before.turn === 1) englishOk += 1; else englishFail += 1;
  }
  const comboText = (await english.page.locator('.arcade-combo').textContent().catch(() => '')) || '';
  report.scenarios.english = { englishOk, englishFail, comboText };
  if (englishFail === 0 && englishOk === 10) pass('English regression: 10/10 từ', `${englishOk}`);
  else fail('English regression: 10/10 từ', JSON.stringify(report.scenarios.english));
  if (/x(?:[5-9]|10)/.test(comboText)) pass('Chuỗi tiếng Anh vẫn tăng', comboText.trim()); else fail('Chuỗi tiếng Anh vẫn tăng', comboText.trim());

  await english.context.close();
  await solo.context.close();
  await back.context.close();
  await nfd.context.close();
  await comp.context.close();
  await hook.context.close();
  await mixed.context.close();
  await dbl.context.close();

  await runMultiplayer('1V1', ACCOUNTS.slice(0, 2), 6);
  await runMultiplayer('TRIO', ACCOUNTS.slice(0, 3), 5);
  await runMultiplayer('2V2', ACCOUNTS.slice(0, 4), 4);
} catch (error) {
  report.errors.push(error.stack || error.message);
  console.error('QA ERROR', error);
} finally {
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(out, 'qa-report.json'), JSON.stringify(report, null, 2));
  console.log(`\nChecks: ${report.checks.filter((c) => c.status === 'PASS').length} pass / ${report.checks.filter((c) => c.status === 'FAIL').length} fail`);
  console.log(`Page errors: ${report.errors.length}`);
  await browser.close();
  if (report.checks.some((c) => c.status === 'FAIL') || report.errors.length) process.exitCode = 1;
}

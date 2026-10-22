'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const engine = import('../../shared/arcade/engine.mjs');
test('Computer: seed, case, NFC/Unicode, errors, timer, duplicate and forged score', async () => {
  const { challenge, normalizeWord, replay } = await engine;
  assert.deepEqual(challenge('computer_rush', 'seed', 6), challenge('computer_rush', 'seed', 6));
  assert.equal(normalizeWord('  thiết kế '), 'THIẾT KẾ');
  const word = challenge('computer_rush', 'seed', 0, 'vietnamese').word;
  const event = { index: 0, at: 1200, value: word.toLowerCase().normalize('NFD'), errors: 0 };
  assert.equal(replay('computer_rush', 'seed', [event], { difficulty: 'vietnamese' }).correct, 1);
  assert.equal(replay('computer_rush', 'seed', [{ ...event, value: 'wrong' }], { difficulty: 'vietnamese' }).correct, 0);
  assert.ok(replay('computer_rush', 'seed', [{ ...event, errors: 3 }], { difficulty: 'vietnamese' }).score < replay('computer_rush', 'seed', [event], { difficulty: 'vietnamese' }).score);
  assert.throws(() => replay('computer_rush', 'seed', [event, event]));
  assert.throws(() => replay('computer_rush', 'seed', [{ ...event, at: 20 }]));
  assert.throws(() => replay('computer_rush', 'seed', [{ ...event, at: 60001 }]));
  assert.equal(replay('computer_rush', 'seed', [{ ...event, score: 9999999 }], { difficulty: 'vietnamese' }).score, replay('computer_rush', 'seed', [event], { difficulty: 'vietnamese' }).score);
});
test('Memory: deterministic patterns, phases, correct/wrong evidence, deselect, duplicate, progression', async () => {
  const { challenge, memoryLevel, memoryPhase, memorySelectAt, toggleCell, replay } = await engine;
  const seed = 'memory';
  for (let i = 0; i < 30; i++) {
    const c = challenge('memory_flash', seed, i);
    assert.deepEqual(c, challenge('memory_flash', seed, i));
    assert.equal(new Set(c.cells).size, c.targets);
    assert.ok(c.cells.every((x) => x < c.size ** 2));
  }
  const c = challenge('memory_flash', seed, 0);
  assert.equal(memoryPhase(0, 0, 0, c), 'PREPARE');
  assert.equal(memoryPhase(c.prepareMs, 0, 0, c), 'FLASH');
  assert.equal(memoryPhase(c.prepareMs + c.revealMs, 0, 0, c), 'HIDE');
  assert.equal(memoryPhase(c.prepareMs + c.revealMs + c.hideMs, 0, 0, c), 'SELECT');
  const event = { index: 0, at: memorySelectAt(0, 0, c) + 500, cells: c.cells };
  assert.equal(replay('memory_flash', seed, [event]).correct, 1);
  assert.throws(() => replay('memory_flash', seed, [{ ...event, at: 1000 }]));
  assert.throws(() => replay('memory_flash', seed, [{ ...event, cells: [c.cells[0], c.cells[0]] }]));
  assert.equal(replay('memory_flash', seed, [{ ...event, cells: [0, 1].every((x) => c.cells.includes(x)) ? [7, 8] : [0, 1], correct: true }]).correct, 0);
  assert.deepEqual(toggleCell([1], 1, 2), []); assert.deepEqual(toggleCell([1, 2], 3, 2), [1, 2]);
  assert.equal(memoryLevel(0).size, 3); assert.equal(memoryLevel(9).size, 4); assert.equal(memoryLevel(21).size, 5);
  assert.ok(memoryLevel(12).revealMs < memoryLevel(0).revealMs);
});
test('UX rules v2: readable trick rules, settled entrance timing and authoritative opposite evidence', async () => {
  const { challenge, replay, OPPOSITE } = await engine;
  const events = []; let at = 0, sawOpposite = false, sawEntrance = false;
  while (at < 55000) {
    const c = challenge('direction_rush', 'fair', events.length, 'mixed', { previousAt: at, durationMs: 60000, rulesVersion: 2 });
    assert.equal(c.expected, c.opposite ? OPPOSITE[c.direction] : c.direction);
    assert.deepEqual(c, challenge('direction_rush', 'fair', events.length, 'mixed', { previousAt: at, durationMs: 60000, rulesVersion: 2 }));
    if (c.opposite) { assert.ok(at >= 40000 && at < 45000); sawOpposite = true; }
    if (c.revealMs) { sawEntrance = true; assert.equal(c.stage, 'entrance'); }
    at += c.revealMs + 400;
    events.push({ index: events.length, at, direction: c.expected });
  }
  assert.ok(sawOpposite && sawEntrance);
  assert.equal(replay('direction_rush', 'fair', events).correct, events.length);
  const first = challenge('direction_rush', 'fair', 0, 'mixed', { rulesVersion: 1 });
  assert.equal(first.revealMs, 0); assert.equal(first.expected, first.direction);
});
test('UX memory: separate size/targets/time ramp, pattern diversity and timeout evidence', async () => {
  const { challenge, memoryLevel, replay, memorySelectAt } = await engine;
  assert.deepEqual([memoryLevel(5).targets, memoryLevel(5).revealMs], [memoryLevel(6).targets, memoryLevel(6).revealMs]);
  assert.equal(memoryLevel(5).size, 3); assert.equal(memoryLevel(6).size, 4);
  for (let level = 1; level < 14; level++) {
    const before = memoryLevel((level - 1) * 3), after = memoryLevel(level * 3);
    assert.ok(['size', 'targets', 'revealMs', 'selectMs'].filter((key) => before[key] !== after[key]).length <= 1, `Level ${level + 1} changes multiple variables`);
  }
  assert.equal(new Set(Array.from({ length: 10 }, (_, i) => challenge('memory_flash', 'variety', i).kind)).size, 5);
  const c = challenge('memory_flash', 'variety', 0);
  const timeout = { index: 0, at: memorySelectAt(0, 0, c) + c.selectMs, cells: [c.cells[0]], timeout: true };
  assert.equal(replay('memory_flash', 'variety', [timeout]).timeoutCount, 1);
  assert.equal(replay('memory_flash', 'variety', [timeout]).correct, 0);
  assert.throws(() => replay('memory_flash', 'variety', [{ ...timeout, at: memorySelectAt(0, 0, c) + 200 }]));
  assert.equal(challenge('memory_flash', 'variety', 1, 'mixed', { previousCorrect: false }).restMs, 800);
  assert.equal(challenge('memory_flash', 'variety', 1, 'mixed', { previousCorrect: true }).restMs, 320);
  assert.equal(challenge('memory_flash', 'variety', 0, 'mixed', { rulesVersion: 1 }).revealMs, 1800);
});
test('Direction: four arrows, WASD, swipe, 55 rapid challenges, wrong, timeout, impossible reaction', async () => {
  const { challenge, replay, directionForKey, directionForSwipe } = await engine;
  for (const [key, dir] of Object.entries({ ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', w: 'UP', s: 'DOWN', a: 'LEFT', D: 'RIGHT' })) assert.equal(directionForKey(key), dir);
  assert.equal(directionForKey('q'), null);
  assert.equal(directionForKey('constructor'), null);
  assert.equal(directionForSwipe(50, 3), 'RIGHT'); assert.equal(directionForSwipe(-50, 3), 'LEFT');
  assert.equal(directionForSwipe(3, -50), 'UP'); assert.equal(directionForSwipe(3, 50), 'DOWN'); assert.equal(directionForSwipe(4, 4), null);
  const events = Array.from({ length: 55 }, (_, i) => ({ index: i, at: (i + 1) * 180, direction: challenge('direction_rush', 'seed', i).direction }));
  assert.equal(replay('direction_rush', 'seed', events).correct, 55);
  assert.equal(replay('direction_rush', 'seed', events).avgResponseMs, 180);
  assert.deepEqual(challenge('direction_rush', 'seed', 45), challenge('direction_rush', 'seed', 45));
  assert.equal(replay('direction_rush', 'seed', [{ ...events[0], direction: null, at: 1800 }]).correct, 0);
  assert.throws(() => replay('direction_rush', 'seed', [{ ...events[0], at: 0 }]));
  assert.throws(() => replay('direction_rush', 'seed', [{ ...events[0], direction: null, at: 100 }]));
  assert.throws(() => replay('direction_rush', 'seed', [{ ...events[0], direction: 'FORGED' }]));
  assert.throws(() => replay('direction_rush', 'seed', [{ ...events[0], direction: 'constructor' }]));
});


test('Direction v3: preview stimuli stay deterministic, input can follow during animation, server enforces stumble', async()=>{
  const {challenge,replay,DIRECTION_STUMBLE_MS,OPPOSITE}=await import('../../shared/arcade/engine.mjs');
  const options={rulesVersion:3,durationMs:60000};
  const first=challenge('direction_rush','queue',0,'mixed',options);
  const events=[{index:0,at:120,direction:first.expected}];
  const next=challenge('direction_rush','queue',1,'mixed',{...options,previousAt:120});
  events.push({index:1,at:185,direction:next.expected});
  assert.equal(replay('direction_rush','queue',events,options).correct,2);
  const wrong=challenge('direction_rush','queue',2,'mixed',{...options,previousAt:185});
  events.push({index:2,at:260,direction:OPPOSITE[wrong.expected]});
  const after=challenge('direction_rush','queue',3,'mixed',{...options,previousAt:260,previousCorrect:false});
  assert.equal(after.stumbleMs,DIRECTION_STUMBLE_MS);
  assert.throws(()=>replay('direction_rush','queue',[...events,{index:3,at:320,direction:after.expected}],options));
  const before=replay('direction_rush','queue',events,options);assert.equal(before.combo,0);
  assert.equal(before.score,replay('direction_rush','queue',events.slice(0,2),options).score,'wrong does not retroactively remove points');
  events.push({index:3,at:260+DIRECTION_STUMBLE_MS+65,direction:after.expected});
  assert.equal(replay('direction_rush','queue',events,options).correct,3);
  for(let i=0;i<12;i++)assert.equal(challenge('direction_rush','queue',i,'mixed',{...options,previousAt:41000}).direction,challenge('direction_rush','queue',i,'mixed',{...options,previousAt:0}).direction);
  const inverted=challenge('direction_rush','queue',4,'mixed',{...options,previousAt:41000});assert.equal(inverted.expected,OPPOSITE[inverted.direction]);
});

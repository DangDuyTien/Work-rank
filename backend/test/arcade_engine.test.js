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
  assert.equal(memoryPhase(300, 0, 0, c), 'FLASH');
  assert.equal(memoryPhase(2100, 0, 0, c), 'HIDE');
  assert.equal(memoryPhase(2250, 0, 0, c), 'SELECT');
  const event = { index: 0, at: memorySelectAt(0, 0, c) + 500, cells: c.cells };
  assert.equal(replay('memory_flash', seed, [event]).correct, 1);
  assert.throws(() => replay('memory_flash', seed, [{ ...event, at: 1000 }]));
  assert.throws(() => replay('memory_flash', seed, [{ ...event, cells: [c.cells[0], c.cells[0]] }]));
  assert.equal(replay('memory_flash', seed, [{ ...event, cells: [0, 1].every((x) => c.cells.includes(x)) ? [7, 8] : [0, 1], correct: true }]).correct, 0);
  assert.deepEqual(toggleCell([1], 1, 2), []); assert.deepEqual(toggleCell([1, 2], 3, 2), [1, 2]);
  assert.equal(memoryLevel(0).size, 3); assert.equal(memoryLevel(9).size, 4); assert.equal(memoryLevel(21).size, 5);
  assert.ok(memoryLevel(12).revealMs < memoryLevel(0).revealMs);
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

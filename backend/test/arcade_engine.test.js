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
test('Memory v3: reachable multi-dimensional ramp, harder patterns late and timeout evidence', async () => {
  const { challenge, memoryLevel, replay, memorySelectAt } = await engine;
  const memory = await import('../../shared/arcade/memory.mjs');

  // 1. Mọi trục áp lực đều tăng theo nấc, không có bậc nào "dễ lại".
  const curve = memory.memoryCurve();
  for (let index = 1; index < curve.length; index++) {
    const before = curve[index - 1], after = curve[index];
    assert.ok(after.size >= before.size, `grid regressed at level ${after.level}`);
    assert.ok(after.targets >= before.targets, `targets regressed at level ${after.level}`);
    assert.ok(after.revealMs < before.revealMs, `reveal regressed at level ${after.level}`);
    assert.ok(after.selectMs < before.selectMs, `answer window regressed at level ${after.level}`);
    assert.ok(after.prepareMs < before.prepareMs, `prepare regressed at level ${after.level}`);
    assert.ok(after.restMs < before.restMs, `transition regressed at level ${after.level}`);
  }
  assert.deepEqual([curve[0].size, curve[0].targets, curve[0].revealMs, curve[0].selectMs], [3, 2, 2000, 5000]);
  assert.ok(curve.at(-1).revealMs <= 800);
  assert.ok(curve.at(-1).selectMs <= 2500);

  // 2. Trong 60 giây, người chơi trung bình phải đi tới vùng RUSH.
  const run = memory.simulateMemoryRun();
  assert.ok(run.length >= 14, `only ${run.length} rounds fit in 60s`);
  assert.ok(run.at(-1).level >= 9, `only reached level ${run.at(-1).level}`);
  assert.ok(run.some((round) => round.stage === 'RUSH'));

  // 3. Level thấp còn pattern dễ; level cao gần như không còn.
  const easyKinds = new Set(['line', 'corners', 'block']);
  const easyRatio = (index) => {
    let easy = 0;
    for (let seed = 0; seed < 120; seed++) if (easyKinds.has(challenge('memory_flash', `seed-${seed}`, index).kind)) easy++;
    return easy / 120;
  };
  assert.ok(easyRatio(0) > easyRatio(22) + 0.15, `easy pattern ratio did not drop: ${easyRatio(0)} vs ${easyRatio(22)}`);

  // 4. Pattern thật sự khó hơn khi lên nấc (không chỉ đổi grid).
  const meanDifficulty = (index) => {
    let total = 0;
    for (let seed = 0; seed < 120; seed++) total += challenge('memory_flash', `seed-${seed}`, index).patternDifficulty;
    return total / 120;
  };
  assert.ok(meanDifficulty(24) > meanDifficulty(4) + 12, `pattern difficulty did not ramp: ${meanDifficulty(4)} → ${meanDifficulty(24)}`);

  // 5. Tất định, đúng số ô, không trùng, không tràn bảng.
  for (let index = 0; index < 60; index++) {
    const a = challenge('memory_flash', 'v3', index), b = challenge('memory_flash', 'v3', index);
    assert.deepEqual(a, b);
    assert.equal(a.cells.length, a.targets);
    assert.equal(new Set(a.cells).size, a.targets);
    assert.ok(a.cells.every((cell) => Number.isInteger(cell) && cell >= 0 && cell < a.size * a.size));
    assert.ok(a.patternDifficulty >= 0 && a.patternDifficulty <= 100);
  }

  // 6. Hết giờ chọn là fail có bằng chứng, không phải im lặng.
  const c = challenge('memory_flash', 'variety', 0);
  const timeout = { index: 0, at: memorySelectAt(0, 0, c) + c.selectMs, cells: [c.cells[0]], timeout: true };
  assert.equal(replay('memory_flash', 'variety', [timeout]).timeoutCount, 1);
  assert.equal(replay('memory_flash', 'variety', [timeout]).correct, 0);
  assert.throws(() => replay('memory_flash', 'variety', [{ ...timeout, at: memorySelectAt(0, 0, c) + 200 }]));
  assert.throws(() => replay('memory_flash', 'variety', [{ index: 0, at: memorySelectAt(0, 0, c) + c.selectMs + 400, cells: c.cells }]));

  // 7. Sai thì được thở thêm một nhịp, nhưng vẫn ngắn hơn luật cũ.
  assert.ok(challenge('memory_flash', 'variety', 1, 'mixed', { previousCorrect: false }).restMs > challenge('memory_flash', 'variety', 1, 'mixed', { previousCorrect: true }).restMs);
  assert.ok(challenge('memory_flash', 'variety', 1, 'mixed', { previousCorrect: false }).restMs <= 800);

  // 8. Phòng cũ (rulesVersion 2) giữ nguyên luật để replay không lệch.
  assert.equal(memoryLevel(0, 2).revealMs, 2000);
  assert.equal(memoryLevel(0, 2).selectMs, 12000);
  assert.equal(memoryLevel(0, 2).size, 3);
  assert.equal(challenge('memory_flash', 'variety', 0, 'mixed', { rulesVersion: 1 }).revealMs, 1800);
});
test('Memory rapid rounds: 120 challenges stay deterministic without duplicate or stale state', async () => {
  const { challenge, replay, memorySelectAt } = await engine;
  const durationMs = 600000;
  let at = 0;
  const events = [];
  for (let index = 0; index < 120; index++) {
    const c = challenge('memory_flash', 'rapid', index, 'mixed', { previousAt: at, durationMs });
    const selectAt = memorySelectAt(at, index, c);
    at = selectAt + 140;
    events.push({ index, at, cells: c.cells });
  }
  const metrics = replay('memory_flash', 'rapid', events, { durationMs });
  assert.equal(metrics.attempts, 120);
  assert.equal(metrics.correct, 120);
  assert.equal(metrics.timeoutCount, 0);
  assert.equal(metrics.bestCombo, 120);
  assert.ok(new Set(events.map((event) => event.cells.join(','))).size >= 110, 'gần như không có challenge trùng');
  for (let index = 1; index < events.length; index++) assert.notDeepEqual(events[index].cells, events[index - 1].cells, `round ${index} repeats the previous pattern`);
  // Mỗi vòng chỉ có một challenge tại index của nó; gọi lại vẫn ra đúng cái đó.
  for (const index of [0, 17, 40, 119]) {
    assert.deepEqual(challenge('memory_flash', 'rapid', index, 'mixed', { previousAt: events[index - 1]?.at || 0, durationMs }), challenge('memory_flash', 'rapid', index, 'mixed', { previousAt: events[index - 1]?.at || 0, durationMs }));
  }
  // Không có "ghost round": index trùng hoặc lùi thời gian đều bị từ chối.
  assert.throws(() => replay('memory_flash', 'rapid', [events[0], { ...events[1], index: 0 }], { durationMs }));
  assert.throws(() => replay('memory_flash', 'rapid', [events[0], { ...events[1], at: events[0].at - 10 }], { durationMs }));
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

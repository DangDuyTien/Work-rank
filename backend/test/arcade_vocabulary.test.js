'use strict';

/**
 * Computer Rush — vocabulary & challenge-generation acceptance.
 *
 * Không mock engine: test trực tiếp module chia sẻ mà cả client và server dùng,
 * nên kết quả ở đây đúng với chuỗi người chơi thực sự nhận.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const vocabulary = () => import('../../shared/arcade/vocabulary/index.mjs');
const engine = () => import('../../shared/arcade/engine.mjs');

const TOTAL_MIN = 2500;
const TOTAL_MAX = 3200;

test('Dataset: đủ số lượng, 0 trùng sau normalize, 0 entry hỏng', async () => {
  const { CHALLENGES, VOCAB_STATS, normalizeKey } = await vocabulary();

  assert.ok(CHALLENGES.length >= TOTAL_MIN, `chỉ có ${CHALLENGES.length} entry`);
  assert.ok(CHALLENGES.length <= TOTAL_MAX, `quá nhiều: ${CHALLENGES.length}`);
  assert.equal(VOCAB_STATS.duplicates.length, 0, `trùng: ${VOCAB_STATS.duplicates.map((d) => d.key).join(', ')}`);
  assert.equal(VOCAB_STATS.unique, CHALLENGES.length);

  const ids = new Set();
  for (const entry of CHALLENGES) {
    assert.equal(entry.text, entry.text.normalize('NFC'), `không NFC: ${entry.id}`);
    assert.equal(entry.text, entry.text.trim(), `khoảng trắng đầu/cuối: ${entry.id}`);
    assert.equal(entry.text, entry.text.replace(/\s+/gu, ' '), `khoảng trắng lặp: ${entry.id}`);
    assert.equal(entry.text, normalizeKey(entry.text), `không phải dạng hiển thị chuẩn: ${entry.id}`);
    assert.ok(!/[?<>]|undefined|null/iu.test(entry.text), `ký tự rác: ${entry.id} = ${entry.text}`);
    assert.ok(Array.from(entry.text).length >= 3, `quá ngắn: ${entry.id}`);
    assert.ok(Array.from(entry.text).length <= 40, `quá dài: ${entry.id}`);
    assert.ok(['en', 'vi'].includes(entry.language), `ngôn ngữ lạ: ${entry.id}`);
    assert.ok(['easy', 'medium', 'hard'].includes(entry.difficulty), `độ khó lạ: ${entry.id}`);
    assert.ok(['short', 'medium', 'long', 'phrase'].includes(entry.length), `length lạ: ${entry.id}`);
    assert.ok(entry.family.length > 0, `thiếu family: ${entry.id}`);
    assert.ok(!ids.has(entry.id), `id trùng: ${entry.id}`);
    ids.add(entry.id);
  }
});

test('Phân bố: ngôn ngữ, category, độ khó, độ dài', async () => {
  const { VOCAB_STATS } = await vocabulary();
  const total = VOCAB_STATS.total;
  const share = (value) => value / total;

  const en = share(VOCAB_STATS.byLanguage.en);
  const vi = share(VOCAB_STATS.byLanguage.vi);
  assert.ok(en >= 0.55 && en <= 0.65, `English ${(en * 100).toFixed(1)}%`);
  assert.ok(vi >= 0.35 && vi <= 0.45, `Vietnamese ${(vi * 100).toFixed(1)}%`);

  const categories = Object.values(VOCAB_STATS.byCategory);
  assert.ok(categories.length >= 10, `chỉ có ${categories.length} category`);
  assert.ok(Math.max(...categories) / total <= 0.25, 'một category chiếm quá nhiều');

  for (const tier of ['easy', 'medium', 'hard']) {
    const value = share(VOCAB_STATS.byDifficulty[tier] || 0);
    assert.ok(value >= 0.12, `difficulty ${tier} chỉ ${(value * 100).toFixed(1)}%`);
  }
  for (const bucket of ['short', 'medium', 'long', 'phrase']) {
    const value = share(VOCAB_STATS.byLength[bucket] || 0);
    assert.ok(value >= 0.12, `length ${bucket} chỉ ${(value * 100).toFixed(1)}%`);
  }
  assert.ok(share(VOCAB_STATS.byLength.phrase) <= 0.25, 'phrase chiếm quá nhiều');
});

test('Một trận 100 challenge: không lặp, tất định theo seed', async () => {
  const { challenge, buildComputerSequence } = await engine();

  const sequence = buildComputerSequence('match-one', 'mixed', 100);
  assert.equal(sequence.length, 100);
  assert.equal(new Set(sequence.map((entry) => entry.id)).size, 100, 'có challenge lặp trong cùng trận');

  const first = challenge('computer_rush', 'match-one', 0);
  assert.deepEqual(first, challenge('computer_rush', 'match-one', 0));
  assert.ok(first.word.length > 0 && first.language && first.challengeId);

  const other = buildComputerSequence('match-two', 'mixed', 100).map((e) => e.id);
  const overlap = new Set(sequence.map((e) => e.id).filter((id) => other.includes(id))).size;
  assert.ok(overlap < 10, `hai seed khác nhau trùng ${overlap} challenge`);
});

test('Cụm gần trùng: không cùng họ từ trong 5 vị trí liền nhau', async () => {
  const { buildComputerSequence } = await engine();
  let violations = 0;
  let pairs = 0;

  for (let match = 0; match < 120; match += 1) {
    const sequence = buildComputerSequence(`family-${match}`, 'mixed', 60);
    for (let i = 0; i < sequence.length; i += 1) {
      for (let j = Math.max(0, i - 4); j < i; j += 1) {
        pairs += 1;
        if (sequence[j].family === sequence[i].family) violations += 1;
      }
    }
  }
  assert.equal(violations, 0, `${violations}/${pairs} cặp cùng họ từ đứng sát nhau`);
});

test('1.000 trận mô phỏng: coverage cao, không lặp trong trận, lặp giữa trận thấp', async () => {
  const { buildComputerSequence } = await engine();
  const { CHALLENGES } = await vocabulary();
  const matches = 1000;
  const perMatch = 50;
  const seen = new Set();
  let duplicatedMatches = 0;
  let crossOverlap = 0;
  let crossTotal = 0;
  let previous = new Set();

  for (let match = 0; match < matches; match += 1) {
    const sequence = buildComputerSequence(`sim-${match}`, 'mixed', perMatch);
    const ids = sequence.map((entry) => entry.id);
    if (new Set(ids).size !== ids.length) duplicatedMatches += 1;
    for (const id of ids) seen.add(id);
    for (const id of new Set(ids)) {
      crossTotal += 1;
      if (previous.has(id)) crossOverlap += 1;
    }
    previous = new Set(ids);
  }

  assert.equal(duplicatedMatches, 0, `${duplicatedMatches} trận có từ lặp bên trong`);
  const coverage = seen.size / CHALLENGES.length;
  assert.ok(coverage >= 0.9, `coverage ${(coverage * 100).toFixed(1)}% vocabulary`);
  const repeatRate = crossOverlap / crossTotal;
  assert.ok(repeatRate < 0.05, `lặp giữa hai trận liên tiếp ${(repeatRate * 100).toFixed(2)}%`);
});

test('Server chọn seed: hai trận liên tiếp gần như không trùng từ', async () => {
  const { chooseComputerSeed, computerSequenceIds } = await engine();
  let previous = [];
  let overlapTotal = 0;
  let worst = 0;
  let counter = 0;
  const randomSeed = () => `candidate-${(counter += 1)}`;

  for (let match = 0; match < 120; match += 1) {
    const seed = chooseComputerSeed({ recentIds: previous, difficulty: 'mixed', randomSeed });
    const ids = computerSequenceIds(seed, 'mixed', 60);
    if (match > 0) {
      const before = new Set(previous);
      const overlap = ids.filter((id) => before.has(id)).length;
      overlapTotal += overlap;
      worst = Math.max(worst, overlap);
    }
    previous = ids;
  }

  const average = overlapTotal / 119;
  assert.ok(average <= 2, `trung bình trùng ${average.toFixed(2)} từ / 60`);
  assert.ok(worst <= 2, `trận tệ nhất trùng ${worst} từ`);
});

test('Multiplayer: cùng seed → cùng chuỗi cho mọi người, replay vẫn chấm đúng', async () => {
  const { challenge, replay } = await engine();
  const seed = 'room-abc';

  const playerOne = Array.from({ length: 25 }, (_, index) => challenge('computer_rush', seed, index, 'mixed', { rulesVersion: 2 }));
  const playerTwo = Array.from({ length: 25 }, (_, index) => challenge('computer_rush', seed, index, 'mixed', { rulesVersion: 2 }));
  assert.deepEqual(playerOne.map((c) => c.word), playerTwo.map((c) => c.word));

  const events = [];
  let at = 0;
  for (let index = 0; index < 12; index += 1) {
    const current = playerOne[index];
    at += Math.max(200, Array.from(current.word).length * 40);
    events.push({ index, at, value: current.word.toLowerCase().normalize('NFD'), errors: 0 });
  }
  const metrics = replay('computer_rush', seed, events, { rulesVersion: 2, durationMs: 60000 });
  assert.equal(metrics.correct, events.length);
  assert.ok(metrics.score > 0);

  const forged = events.map((event, i) => (i === 0 ? { ...event, value: 'khong-dung-tu-nay' } : event));
  assert.ok(replay('computer_rush', seed, forged, { rulesVersion: 2, durationMs: 60000 }).correct < events.length);
});

test('Bộ lọc độ khó vẫn đúng: vietnamese / easy / medium / hard', async () => {
  const { challenge } = await engine();
  for (let index = 0; index < 40; index += 1) {
    assert.equal(challenge('computer_rush', 'filter-vi', index, 'vietnamese').language, 'vi');
    assert.equal(challenge('computer_rush', 'filter-easy', index, 'easy').difficulty, 'easy');
    assert.equal(challenge('computer_rush', 'filter-medium', index, 'medium').difficulty, 'medium');
    assert.equal(challenge('computer_rush', 'filter-hard', index, 'hard').difficulty, 'hard');
  }
});

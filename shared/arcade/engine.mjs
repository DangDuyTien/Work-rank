import { CHALLENGES, COMPUTER_SEQUENCE_LIMIT, entriesForDifficulty, tierForIndex } from './vocabulary/index.mjs';
import { normalizeTypingKey, minimumTypingMs } from './typingText.mjs';
import { ARCADE_GAME_TYPES } from '../gameRegistry.mjs';
import { GAME_MODES, MODE_IDS, canonicalMode, modeSpec, capacityFor, aggregateTeams, teamOutcome, teamScore, balancedTeam, teamCounts, teamsAreBalanced, compareTeams } from './modes.mjs';
import { memoryLevel as memoryLevelV3, buildMemoryPattern } from './memory.mjs';

export const GAME_TYPES = ARCADE_GAME_TYPES;
export { GAME_MODES, MODE_IDS, canonicalMode, modeSpec, capacityFor, aggregateTeams, teamOutcome, teamScore, balancedTeam, teamCounts, teamsAreBalanced, compareTeams };
export const CAPACITY = Object.freeze(Object.fromEntries(Object.values(GAME_MODES).map((mode) => [mode.id, mode.capacity])));
export const RULES_VERSION = 3;
export const rulesVersionFor = game => game === 'direction_rush' || game === 'memory_flash' ? 3 : 2;
export const DIRECTION_STUMBLE_MS = 450;
export const DIRECTION_MIN_RESPONSE_MS = 60;
/**
 * Dung sai cho event "ở tương lai" so với đồng hồ server.
 *
 * MySQL lưu `started_at` dạng DATETIME không có phần lẻ, nên mốc bắt đầu có
 * thể bị làm tròn tới ±500ms. Cộng thêm jitter mạng, 150ms cũ làm client
 * hợp lệ bị từ chối ("Lựa chọn hoặc thời gian ghi nhớ không hợp lệ").
 * 1500ms vẫn chặn việc gửi trước cả trận, vì `at <= durationMs` và
 * finish vẫn kiểm tra đồng hồ thật.
 */
export const EVENT_CLOCK_TOLERANCE_MS = 1500;
export const ARROWS = Object.freeze({ UP: '↑', DOWN: '↓', LEFT: '←', RIGHT: '→' });
export const OPPOSITE = Object.freeze({ UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' });
export const normalizeWord = normalizeTypingKey;

// Each challenge is indexed independently: clients cannot drift when a player is slower.
function random(seed, index) {
  let h = 2166136261;
  for (const c of `${seed}:${index}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6D2B79F5;
    let x = Math.imul(h ^ h >>> 15, 1 | h);
    x ^= x + Math.imul(x ^ x >>> 7, 61 | x);
    return ((x ^ x >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Computer Rush — shuffle bag tất định.
 *
 * Vì sao không dùng random-with-replacement như trước:
 * - 2.817 từ nhưng mỗi trận ~50 lượt; chọn độc lập vẫn lặp trong cùng trận.
 * - Shuffle một lần rồi tiêu thụ tuần tự bảo đảm KHÔNG lặp cho tới khi hết bag,
 *   đồng thời giữ nguyên tính thuần tuý: cùng (seed, difficulty, rulesVersion)
 *   → cùng chuỗi trên client và server, nên replay chấm điểm vẫn khớp.
 */
function seededRng(seedText) {
  let h = 2166136261;
  for (const c of String(seedText)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6D2B79F5;
    let x = Math.imul(h ^ h >>> 15, 1 | h);
    x ^= x + Math.imul(x ^ x >>> 7, 61 | x);
    return ((x ^ x >>> 14) >>> 0) / 4294967296;
  };
}

function shuffled(list, rng) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const FAMILY_GAP = 6;

function takeWithFamilyGap(bucket, cursor, recentFamilies) {
  const start = cursor.value;
  if (start >= bucket.length) return null;
  const window = Math.min(bucket.length - start, 60);
  for (let offset = 0; offset < window; offset++) {
    const candidate = bucket[start + offset];
    if (!recentFamilies.includes(candidate.family)) {
      if (offset > 0) {
        bucket[start + offset] = bucket[start];
        bucket[start] = candidate;
      }
      cursor.value = start + 1;
      return candidate;
    }
  }
  // Cả cửa sổ cùng họ từ (hiếm): vẫn phải tiêu thụ để không kẹt.
  cursor.value = start + 1;
  return bucket[start];
}

/**
 * Chuỗi challenge của một trận Computer Rush.
 *
 * Chuỗi chỉ phụ thuộc (seed, difficulty) — KHÔNG phụ thuộc rulesVersion, vì
 * luật chơi không đổi nghĩa của từ. Nếu gắn rulesVersion vào đây thì client
 * gọi mặc định v3 còn phòng đang chạy v2 sẽ ra hai chuỗi khác nhau và replay
 * chấm sai.
 *
 * @param {string} seed
 * @param {'mixed'|'easy'|'medium'|'hard'|'vietnamese'} difficulty
 * @param {number} limit số challenge tối đa (512 đủ cho 60s ở nhịp nhanh nhất)
 */
export function buildComputerSequence(seed, difficulty = 'mixed', limit = COMPUTER_SEQUENCE_LIMIT) {
  const pool = entriesForDifficulty(difficulty);
  if (!pool.length) return [];

  const buckets = { easy: [], medium: [], hard: [] };
  for (const entry of pool) (buckets[entry.difficulty] || buckets.medium).push(entry);

  const rng = seededRng(`${seed}|${difficulty}`);
  for (const tier of ['easy', 'medium', 'hard']) buckets[tier] = shuffled(buckets[tier], rng);

  const cursor = { easy: { value: 0 }, medium: { value: 0 }, hard: { value: 0 } };
  const fixedTier = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : null;
  const out = [];
  const recentFamilies = [];

  for (let i = 0; i < limit; i++) {
    let tier = fixedTier || tierForIndex(i);
    if (cursor[tier].value >= buckets[tier].length) {
      // Bag của tier đã cạn (chỉ xảy ra với limit rất lớn): lấy tier còn hàng.
      tier = ['medium', 'easy', 'hard'].find((name) => cursor[name].value < buckets[name].length);
      if (!tier) break;
    }
    const entry = takeWithFamilyGap(buckets[tier], cursor[tier], recentFamilies);
    if (!entry) break;
    out.push(entry);
    recentFamilies.push(entry.family);
    if (recentFamilies.length > FAMILY_GAP) recentFamilies.shift();
  }
  return out;
}

const COMPUTER_SEQUENCE_CACHE = new Map();
const COMPUTER_SEQUENCE_CACHE_LIMIT = 8;

function computerSequence(seed, difficulty) {
  const key = `${seed}|${difficulty}`;
  const cached = COMPUTER_SEQUENCE_CACHE.get(key);
  if (cached) return cached;
  const sequence = buildComputerSequence(seed, difficulty);
  if (COMPUTER_SEQUENCE_CACHE.size >= COMPUTER_SEQUENCE_CACHE_LIMIT) {
    COMPUTER_SEQUENCE_CACHE.delete(COMPUTER_SEQUENCE_CACHE.keys().next().value);
  }
  COMPUTER_SEQUENCE_CACHE.set(key, sequence);
  return sequence;
}

/** ID các challenge đầu trận — dùng cho server chọn seed tránh lặp giữa các trận. */
export function computerSequenceIds(seed, difficulty, limit = 60) {
  return buildComputerSequence(seed, difficulty, limit).map((entry) => entry.id);
}

/**
 * Chọn seed cho trận mới sao cho ít trùng với các trận gần nhất của người chơi.
 *
 * Seed cuối cùng vẫn là nguồn sự thật duy nhất: server lưu seed, client và
 * replay đều dựng lại đúng chuỗi từ seed đó → Duo/Trio vẫn công bằng, không
 * phụ thuộc lịch sử local của từng máy.
 */
export function chooseComputerSeed({
  recentIds = [],
  difficulty = 'mixed',
  attempts = 24,
  maxOverlap = 0,
  limit = 60,
  randomSeed,
} = {}) {
  const recent = new Set(recentIds);
  let best = null;
  let bestOverlap = Infinity;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const seed = randomSeed();
    const overlap = computerSequenceIds(seed, difficulty, limit).filter((id) => recent.has(id)).length;
    if (overlap <= maxOverlap) return seed;
    if (overlap < bestOverlap) {
      bestOverlap = overlap;
      best = seed;
    }
  }
  return best;
}

export const COMPUTER_VOCABULARY_SIZE = CHALLENGES.length;

// MySQL JSON normalizes object-key order. Compare event contents, never their
// serialization order, while still rejecting any changed/added field.
export function sameArcadeEvent(a, b) {
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const keys=Object.keys(a);
  return keys.length===Object.keys(b).length && keys.every(key => Object.hasOwn(b,key) && JSON.stringify(a[key])===JSON.stringify(b[key]));
}

export function memoryLevel(index, rulesVersion = RULES_VERSION) {
  if (rulesVersion >= 3) return memoryLevelV3(index, rulesVersion);
  const level = Math.floor(index / 3) + 1;
  if (rulesVersion >= 2) {
    // Change one difficulty variable at a time, particularly at board-size boundaries.
    const ramp = [[3, 2, 2000], [3, 3, 2000], [4, 3, 2000], [4, 3, 1700], [4, 4, 1700], [4, 5, 1700], [5, 5, 1700], [5, 5, 1400], [5, 6, 1400], [5, 7, 1400], [5, 8, 1400], [5, 8, 1200]];
    const [size, targets, revealMs] = ramp[Math.min(level - 1, ramp.length - 1)];
    return { level, size, targets, prepareMs: 250, revealMs, hideMs: 150, restMs: 320, selectMs: level >= 13 ? 9000 : 12000 };
  }
  const size = level < 4 ? 3 : level < 8 ? 4 : 5;
  const targets = Math.min(size * size - 1, 2 + Math.floor((level - 1) / 2));
  return { level, size, targets, prepareMs: 300, revealMs: Math.max(1000, 1800 - Math.floor((level - 1) / 2) * 100), hideMs: 150, restMs: 400 };
}

export function challenge(game, seed, index, difficulty = 'mixed', options = {}) {
  const { rulesVersion = RULES_VERSION, previousAt = 0, durationMs = 60000, previousCorrect = true } = options;
  const rng = random(seed, index);
  if (game === 'computer_rush') {
    const sequence = computerSequence(seed, difficulty);
    if (!sequence.length) throw new Error('Kho từ Computer Rush rỗng');
    // index vượt quá độ dài bag (chỉ khi limit bị hạ) → quay vòng an toàn.
    const entry = sequence[index] || sequence[index % sequence.length];
    return {
      word: entry.text,
      category: entry.category,
      language: entry.language,
      difficulty: entry.difficulty,
      family: entry.family,
      challengeId: entry.id,
    };
  }
  if (game === 'direction_rush') {
    const direction = Object.keys(ARROWS)[Math.floor(rng() * 4)];
    if (rulesVersion < 2) return { direction, expected: direction, windowMs: Math.max(550, 1800 - Math.floor(index / 8) * 100), revealMs: 0, stage: 'normal', slot: 0, color: 0 };
    const seconds = previousAt / durationMs * 60;
    const stage = seconds < 10 ? 'normal' : seconds < 25 ? 'position' : seconds < 32 ? 'color' : seconds < 40 ? 'entrance' : seconds < 45 ? 'opposite' : 'final';
    const opposite = stage === 'opposite';
    return { direction, expected: opposite ? OPPOSITE[direction] : direction, stage, opposite,
      slot: stage === 'normal' ? 0 : Math.floor(rng() * 3) - 1,
      color: ['color', 'entrance', 'final'].includes(stage) ? Math.floor(rng() * 3) : 0,
      revealMs: rulesVersion >= 3 ? 0 : stage === 'entrance' ? 180 : 0,
      entranceMs: stage === 'entrance' ? 180 : 0,
      stumbleMs: rulesVersion >= 3 && !previousCorrect ? DIRECTION_STUMBLE_MS : 0,
      oppositeUntil: durationMs * .75,
      windowMs: Math.max(650, 1800 - Math.floor(index / 6) * 100 - (seconds >= 50 ? 180 : 0)) };
  }
  const level = memoryLevel(index, rulesVersion);
  if (rulesVersion >= 3) {
    // Sai thì giữ nhịp chậm hơn để người chơi kịp đọc lỗi, nhưng không kéo
    // dài cả trận: trần 620ms và giảm dần theo level.
    level.restMs = previousCorrect ? level.restMs : Math.max(620, level.restMs + 260);
    const pattern = buildMemoryPattern(rng, level.size, level.targets, level.level);
    return { ...level, kind: pattern.kind, patternDifficulty: pattern.difficulty, cells: pattern.cells };
  }
  if (rulesVersion >= 2) level.restMs = previousCorrect ? 320 : 800;
  const cells = Array.from({ length: level.size * level.size }, (_, i) => i);
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  if (rulesVersion < 2) return { ...level, cells: cells.slice(0, level.targets).sort((a, b) => a - b) };
  const n = level.size, row = Math.floor(rng() * n), col = Math.floor(rng() * n);
  const kind = ['scattered', 'line', 'corners', 'shape', 'asymmetric'][index % 5];
  const vertical = rng() > .5;
  const preferred = kind === 'line' ? Array.from({ length: n }, (_, i) => vertical ? row * n + i : i * n + col)
    : kind === 'corners' ? [0, n - 1, n * (n - 1), n * n - 1].sort((a, b) => cells.indexOf(a) - cells.indexOf(b))
      : kind === 'shape' ? [row * n + col, row * n + (col + 1) % n, ((row + 1) % n) * n + col]
        : kind === 'asymmetric' ? cells.filter((c) => (Math.floor(c / n) + c % n) % 2 === 1) : [];
  return { ...level, kind, cells: [...new Set([...preferred, ...cells])].slice(0, level.targets).sort((a, b) => a - b) };
}

export function directionForKey(key) {
  const direction = ({ ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', w: 'UP', s: 'DOWN', a: 'LEFT', d: 'RIGHT' })[key.length === 1 ? key.toLowerCase() : key];
  return typeof direction === 'string' ? direction : null;
}
export function directionForSwipe(dx, dy) {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return null;
  return Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'RIGHT' : 'LEFT' : dy > 0 ? 'DOWN' : 'UP';
}
export function toggleCell(selected, cell, count) {
  return selected.includes(cell) ? selected.filter((x) => x !== cell) : selected.length < count ? [...selected, cell] : selected;
}
export function memoryPhase(elapsed, previousAt, index, board) {
  const start = previousAt + (index ? board.restMs : 0);
  const t = elapsed - start;
  return t < board.prepareMs ? 'PREPARE' : t < board.prepareMs + board.revealMs ? 'FLASH' : t < board.prepareMs + board.revealMs + board.hideMs ? 'HIDE' : 'SELECT';
}
export function memorySelectAt(previousAt, index, board) {
  return previousAt + (index ? board.restMs : 0) + board.prepareMs + board.revealMs + board.hideMs;
}

export function emptyMetrics() {
  return { score: 0, correct: 0, attempts: 0, accuracy: 100, bestCombo: 0, combo: 0, avgResponseMs: 0, perfectCount: 0, wrongCount: 0, timeoutCount: 0, lastCorrect: null, lastResponseMs: 0 };
}

// This pure replay is also the scoring contract. No client score/correct flag is accepted.
export function replay(game, seed, events, { durationMs = 60000, elapsedMs = durationMs, difficulty = 'mixed', rulesVersion = RULES_VERSION } = {}) {
  if (!GAME_TYPES.includes(game) || !Array.isArray(events) || events.length > 1500) throw new Error('Dữ liệu lượt chơi không hợp lệ');
  const metrics = emptyMetrics();
  let previousAt = 0, totalResponse = 0, rawScore = 0, mistakes = 0;
  for (let index = 0; index < events.length; index++) {
    const e = events[index];
    if (!e || e.index !== index || !Number.isInteger(e.at) || e.at <= previousAt || e.at > durationMs || e.at > elapsedMs + EVENT_CLOCK_TOLERANCE_MS) throw new Error('Thời gian hoặc challenge ID không hợp lệ');
    const c = challenge(game, seed, index, difficulty, { rulesVersion, previousAt, durationMs, previousCorrect: metrics.lastCorrect !== false });
    let response = e.at - previousAt, correct = false, base = 100;
    if (game === 'computer_rush') {
      if (typeof e.value !== 'string' || e.value.length > 120 || !Number.isInteger(e.errors) || e.errors < 0 || e.errors > 120) throw new Error('Nội dung gõ không hợp lệ');
      correct = normalizeWord(e.value) === normalizeWord(c.word);
      if (response < (correct ? minimumTypingMs(c.word) : 140)) throw new Error('Hoàn thành từ quá nhanh');
      mistakes += e.errors;
    } else if (game === 'direction_rush') {
      response -= c.revealMs + (c.stumbleMs || 0);
      if (response < (rulesVersion >= 3 ? DIRECTION_MIN_RESPONSE_MS : 80) || (e.direction !== null && response > c.windowMs + 200) || (e.direction !== null && !Object.hasOwn(ARROWS, e.direction))) throw new Error('Phản xạ không hợp lệ');
      if (e.direction === null && response < c.windowMs) throw new Error('Hết giờ không hợp lệ');
      correct = e.direction === c.expected && response <= c.windowMs;
      metrics.timeoutCount += Number(e.direction === null);
      metrics.perfectCount += Number(correct && response <= 350);
    } else {
      response = e.at - memorySelectAt(previousAt, index, c);
      const timeout = rulesVersion >= 2 && e.timeout === true;
      if (response < 120 || !Array.isArray(e.cells) || (timeout ? e.cells.length > c.targets || response < c.selectMs : e.cells.length !== c.targets) || new Set(e.cells).size !== e.cells.length || e.cells.some((x) => !Number.isInteger(x) || x < 0 || x >= c.size * c.size)) throw new Error('Lựa chọn hoặc thời gian ghi nhớ không hợp lệ');
      if (rulesVersion >= 2 && !timeout && response > c.selectMs + 200) throw new Error('Đã hết thời gian chọn ô');
      correct = !timeout && e.cells.every((x) => c.cells.includes(x));
      metrics.timeoutCount += Number(timeout);
      base = 200 + c.level * 30;
    }
    metrics.attempts++;
    metrics.lastCorrect = correct; metrics.lastResponseMs = response;
    metrics.wrongCount += Number(!correct);
    metrics.correct += Number(correct);
    metrics.combo = correct ? metrics.combo + 1 : 0;
    metrics.bestCombo = Math.max(metrics.bestCombo, metrics.combo);
    const speed = Math.max(0, 40 - Math.floor(response / (game === 'direction_rush' ? 30 : 150)));
    if (correct) { rawScore += base + speed + Math.min(metrics.combo, 12) * 8; totalResponse += response; }
    previousAt = e.at;
  }
  metrics.accuracy = metrics.attempts ? Math.round(metrics.correct / (metrics.attempts + mistakes * 0.15) * 10000) / 100 : 100;
  metrics.score = game === 'direction_rush' && rulesVersion >= 3 ? rawScore : Math.round(rawScore * (metrics.accuracy / 100) ** 2);
  metrics.avgResponseMs = metrics.correct ? Math.round(totalResponse / metrics.correct) : 0;
  return metrics;
}

export function compareResults(a, b) {
  return b.score - a.score || b.correct - a.correct || b.accuracy - a.accuracy || a.avgResponseMs - b.avgResponseMs || String(a.id).localeCompare(String(b.id));
}

import { WORD_BANK } from './words.mjs';

export const GAME_TYPES = ['computer_rush', 'direction_rush', 'memory_flash'];
export const CAPACITY = Object.freeze({ SOLO: 1, DUO: 2, TRIO: 3 });
export const ARROWS = Object.freeze({ UP: '↑', DOWN: '↓', LEFT: '←', RIGHT: '→' });
export const normalizeWord = (value) => String(value).normalize('NFC').trim().replace(/\s+/gu, ' ').toLocaleUpperCase('vi');

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

export function memoryLevel(index) {
  const level = Math.floor(index / 3) + 1;
  const size = level < 4 ? 3 : level < 8 ? 4 : 5;
  const targets = Math.min(size * size - 1, 2 + Math.floor((level - 1) / 2));
  return { level, size, targets, prepareMs: 300, revealMs: Math.max(1000, 1800 - Math.floor((level - 1) / 2) * 100), hideMs: 150, restMs: 400 };
}

export function challenge(game, seed, index, difficulty = 'mixed') {
  const rng = random(seed, index);
  if (game === 'computer_rush') {
    const category = WORD_BANK[difficulty] ? difficulty : ['easy', 'medium', 'hard', 'vietnamese'][Math.min(3, Math.floor(index / 5))];
    const words = WORD_BANK[category];
    return { word: words[Math.floor(rng() * words.length)], category };
  }
  if (game === 'direction_rush') return { direction: Object.keys(ARROWS)[Math.floor(rng() * 4)], windowMs: Math.max(550, 1800 - Math.floor(index / 8) * 100) };
  const level = memoryLevel(index);
  const cells = Array.from({ length: level.size * level.size }, (_, i) => i);
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  return { ...level, cells: cells.slice(0, level.targets).sort((a, b) => a - b) };
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
  return { score: 0, correct: 0, attempts: 0, accuracy: 100, bestCombo: 0, combo: 0, avgResponseMs: 0 };
}

// This pure replay is also the scoring contract. No client score/correct flag is accepted.
export function replay(game, seed, events, { durationMs = 60000, elapsedMs = durationMs, difficulty = 'mixed' } = {}) {
  if (!GAME_TYPES.includes(game) || !Array.isArray(events) || events.length > 1500) throw new Error('Dữ liệu lượt chơi không hợp lệ');
  const metrics = emptyMetrics();
  let previousAt = 0, totalResponse = 0, rawScore = 0, mistakes = 0;
  for (let index = 0; index < events.length; index++) {
    const e = events[index];
    if (!e || e.index !== index || !Number.isInteger(e.at) || e.at <= previousAt || e.at > durationMs || e.at > elapsedMs + 150) throw new Error('Thời gian hoặc challenge ID không hợp lệ');
    const c = challenge(game, seed, index, difficulty);
    let response = e.at - previousAt, correct = false, base = 100;
    if (game === 'computer_rush') {
      if (typeof e.value !== 'string' || e.value.length > 120 || !Number.isInteger(e.errors) || e.errors < 0 || e.errors > 120) throw new Error('Nội dung gõ không hợp lệ');
      correct = normalizeWord(e.value) === normalizeWord(c.word);
      if (response < Math.max(140, (correct ? Array.from(c.word).length : 1) * 35)) throw new Error('Hoàn thành từ quá nhanh');
      mistakes += e.errors;
    } else if (game === 'direction_rush') {
      if (response < 80 || (e.direction !== null && response > c.windowMs + 200) || (e.direction !== null && !Object.hasOwn(ARROWS, e.direction))) throw new Error('Phản xạ không hợp lệ');
      if (e.direction === null && response < c.windowMs) throw new Error('Hết giờ không hợp lệ');
      correct = e.direction === c.direction && response <= c.windowMs;
    } else {
      response = e.at - memorySelectAt(previousAt, index, c);
      if (response < 120 || !Array.isArray(e.cells) || e.cells.length !== c.targets || new Set(e.cells).size !== e.cells.length || e.cells.some((x) => !Number.isInteger(x) || x < 0 || x >= c.size * c.size)) throw new Error('Lựa chọn hoặc thời gian ghi nhớ không hợp lệ');
      correct = e.cells.every((x) => c.cells.includes(x));
      base = 200 + c.level * 30;
    }
    metrics.attempts++;
    metrics.correct += Number(correct);
    metrics.combo = correct ? metrics.combo + 1 : 0;
    metrics.bestCombo = Math.max(metrics.bestCombo, metrics.combo);
    const speed = Math.max(0, 40 - Math.floor(response / (game === 'direction_rush' ? 30 : 150)));
    if (correct) { rawScore += base + speed + Math.min(metrics.combo, 12) * 8; totalResponse += response; }
    previousAt = e.at;
  }
  metrics.accuracy = metrics.attempts ? Math.round(metrics.correct / (metrics.attempts + mistakes * 0.15) * 10000) / 100 : 100;
  metrics.score = Math.round(rawScore * (metrics.accuracy / 100) ** 2);
  metrics.avgResponseMs = metrics.correct ? Math.round(totalResponse / metrics.correct) : 0;
  return metrics;
}

export function compareResults(a, b) {
  return b.score - a.score || b.correct - a.correct || b.accuracy - a.accuracy || a.avgResponseMs - b.avgResponseMs || String(a.id).localeCompare(String(b.id));
}

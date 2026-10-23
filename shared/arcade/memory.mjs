/**
 * Memory Flash difficulty model (rules v3).
 *
 * Vì sao tách khỏi engine:
 * - Curve và generator pattern là phần dễ bị chỉnh nhất; tách ra để test
 *   difficulty độc lập với luật chấm điểm.
 * - Mọi thứ ở đây là hàm thuần tuý của (seed, index). Không đọc thời gian
 *   thực, không đọc streak cá nhân — multiplayer phải nhận cùng challenge.
 *
 * Thang độ khó tăng đồng thời nhưng có kiểm soát:
 * grid size, target count, reveal time, answer window, prepare/hide/rest.
 * Level được tính theo index (2 vòng/level) để trong 60 giây người chơi
 * thực sự đi hết EASY → MEDIUM → HARD → RUSH, thay vì kẹt ở level 5-7.
 */

export const MEMORY_RULES_VERSION = 3;
export const MEMORY_ROUNDS_PER_LEVEL = 2;
export const MEMORY_MAX_LEVEL = 14;
export const MEMORY_RUSH_LEVEL = 9;

/** Bảng gốc. Mọi giá trị đều giảm/nhảy theo hướng khó hơn khi level tăng. */
const LEVELS = Object.freeze([
  { level: 1, size: 3, targets: 2, revealMs: 2000, selectMs: 5000, prepareMs: 320, hideMs: 150, restMs: 420 },
  { level: 2, size: 3, targets: 3, revealMs: 1850, selectMs: 4800, prepareMs: 310, hideMs: 145, restMs: 400 },
  { level: 3, size: 3, targets: 3, revealMs: 1700, selectMs: 4600, prepareMs: 300, hideMs: 140, restMs: 380 },
  { level: 4, size: 4, targets: 4, revealMs: 1500, selectMs: 4300, prepareMs: 290, hideMs: 135, restMs: 360 },
  { level: 5, size: 4, targets: 5, revealMs: 1380, selectMs: 4000, prepareMs: 280, hideMs: 130, restMs: 340 },
  { level: 6, size: 4, targets: 6, revealMs: 1260, selectMs: 3800, prepareMs: 270, hideMs: 125, restMs: 320 },
  { level: 7, size: 5, targets: 6, revealMs: 1140, selectMs: 3500, prepareMs: 260, hideMs: 120, restMs: 300 },
  { level: 8, size: 5, targets: 7, revealMs: 1030, selectMs: 3200, prepareMs: 250, hideMs: 118, restMs: 285 },
  { level: 9, size: 5, targets: 8, revealMs: 930, selectMs: 2900, prepareMs: 240, hideMs: 115, restMs: 270 },
  { level: 10, size: 5, targets: 9, revealMs: 850, selectMs: 2600, prepareMs: 230, hideMs: 112, restMs: 255 },
  { level: 11, size: 5, targets: 9, revealMs: 800, selectMs: 2450, prepareMs: 220, hideMs: 110, restMs: 245 },
  { level: 12, size: 5, targets: 10, revealMs: 770, selectMs: 2350, prepareMs: 210, hideMs: 108, restMs: 235 },
  { level: 13, size: 5, targets: 10, revealMs: 740, selectMs: 2250, prepareMs: 200, hideMs: 105, restMs: 225 },
  { level: 14, size: 5, targets: 11, revealMs: 720, selectMs: 2150, prepareMs: 190, hideMs: 100, restMs: 215 },
]);

/** 6x6 không dùng: ở 390px tile sẽ dưới 44px, phá touch target. Xem report. */
export const MEMORY_MAX_GRID = 5;

export function memoryStage(level) {
  if (level >= MEMORY_RUSH_LEVEL) return 'RUSH';
  if (level >= 7) return 'HARD';
  if (level >= 4) return 'MEDIUM';
  return 'EASY';
}
/**
 * @param {number} index challenge index (0-based)
 * @param {number} rulesVersion
 * @returns {{level:number,size:number,targets:number,revealMs:number,selectMs:number,prepareMs:number,hideMs:number,restMs:number,stage:string,rush:boolean}}
 */
export function memoryLevel(index, rulesVersion = MEMORY_RULES_VERSION) {
  const level = Math.max(1, Math.min(MEMORY_MAX_LEVEL, Math.floor(Math.max(0, index) / MEMORY_ROUNDS_PER_LEVEL) + 1));
  const base = LEVELS[level - 1];
  const rush = level >= MEMORY_RUSH_LEVEL;
  return { ...base, stage: memoryStage(level), rush };
}

/** Bảng độ khó đã materialize — dùng cho report và test. */
export function memoryCurve() {
  return LEVELS.map((row) => ({ ...row, stage: memoryStage(row.level), rush: row.level >= MEMORY_RUSH_LEVEL }));
}

function shuffled(list, rng) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickWeighted(entries, rng) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry.kind;
  }
  return entries[entries.length - 1].kind;
}

/**
 * Trọng số pattern theo level.
 *
 * Đầu trận ưu tiên dạng dễ mã hoá (line/corners/block) để người mới học
 * luật. Cuối trận gần như chỉ còn scattered/asymmetric/near-symmetry.
 * Không loại bỏ hoàn toàn dạng dễ — chỉ giảm tần suất.
 */
function patternWeights(level) {
  const t = Math.min(1, Math.max(0, (level - 1) / (MEMORY_MAX_LEVEL - 1)));
  return [
    { kind: 'scattered', weight: 22 + 8 * t },
    { kind: 'asymmetric', weight: 12 + 14 * t },
    { kind: 'edge_center', weight: 8 + 6 * t },
    { kind: 'split_clusters', weight: 8 + 10 * t },
    { kind: 'near_symmetry', weight: 4 + 16 * t },
    { kind: 'line', weight: 14 - 10 * t },
    { kind: 'corners', weight: 10 - 8 * t },
    { kind: 'block', weight: 12 - 8 * t },
  ];
}

function mirrorH(cell, size) {
  return Math.floor(cell / size) * size + (size - 1 - (cell % size));
}

function buildCells(kind, rng, size, targets) {
  const total = size * size;
  const used = new Set();
  const add = (cell) => {
    if (Number.isInteger(cell) && cell >= 0 && cell < total && used.size < targets) used.add(cell);
  };
  const all = Array.from({ length: total }, (_, i) => i);

  if (kind === 'line') {
    const vertical = rng() < 0.5;
    const fixed = Math.floor(rng() * size);
    const line = Array.from({ length: size }, (_, i) => (vertical ? i * size + fixed : fixed * size + i));
    const start = Math.floor(rng() * size);
    for (let i = 0; i < Math.min(targets, size); i++) add(line[(start + i) % size]);
  } else if (kind === 'corners') {
    shuffled([0, size - 1, size * (size - 1), total - 1], rng).forEach(add);
  } else if (kind === 'block') {
    const height = 2;
    const width = Math.max(1, Math.min(2, Math.ceil(Math.min(targets, 4) / 2)));
    const row = Math.floor(rng() * (size - height + 1));
    const col = Math.floor(rng() * (size - width + 1));
    for (let r = 0; r < height; r++) for (let c = 0; c < width; c++) add((row + r) * size + col + c);
  } else if (kind === 'asymmetric') {
    // Không dùng checkerboard thuần: nó vừa dễ nhớ vừa chỉ có vài biến thể.
    // Trộn 60% ô parity lẻ với 40% ô parity chẵn để pattern thật sự bất đối xứng.
    const odd = shuffled(all.filter((cell) => (Math.floor(cell / size) + (cell % size)) % 2 === 1), rng);
    const even = shuffled(all.filter((cell) => (Math.floor(cell / size) + (cell % size)) % 2 === 0), rng);
    const oddCount = Math.max(1, Math.ceil(targets * 0.6));
    odd.slice(0, oddCount).forEach(add);
    even.slice(0, targets - used.size).forEach(add);
  } else if (kind === 'edge_center') {
    const edges = shuffled(all.filter((cell) => {
      const row = Math.floor(cell / size), col = cell % size;
      return row === 0 || col === 0 || row === size - 1 || col === size - 1;
    }), rng);
    const interior = shuffled(all.filter((cell) => {
      const row = Math.floor(cell / size), col = cell % size;
      return row > 0 && col > 0 && row < size - 1 && col < size - 1;
    }), rng);
    const edgeTarget = Math.ceil(targets / 2);
    edges.slice(0, edgeTarget).forEach(add);
    interior.slice(0, targets - used.size).forEach(add);
  } else if (kind === 'split_clusters') {
    const clusters = targets >= 6 ? 3 : 2;
    const centres = [];
    for (let attempt = 0; attempt < 24 && centres.length < clusters; attempt++) {
      const cell = Math.floor(rng() * total);
      const row = Math.floor(cell / size), col = cell % size;
      if (centres.every((other) => Math.abs(Math.floor(other / size) - row) + Math.abs((other % size) - col) >= Math.max(2, Math.floor(size / 2)))) centres.push(cell);
    }
    for (const centre of centres) {
      add(centre);
      const row = Math.floor(centre / size), col = centre % size;
      const neighbours = shuffled([[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]
        .filter(([r, c]) => r >= 0 && c >= 0 && r < size && c < size)
        .map(([r, c]) => r * size + c), rng);
      neighbours.slice(0, targets >= 6 ? 2 : 1).forEach(add);
    }
  } else if (kind === 'near_symmetry') {
    const left = shuffled(all.filter((cell) => (cell % size) < size / 2), rng).slice(0, Math.max(1, Math.floor(targets / 2)));
    left.forEach(add);
    left.forEach((cell) => add(mirrorH(cell, size)));
  }

  const rest = shuffled(all.filter((cell) => !used.has(cell)), rng);
  for (const cell of rest) {
    if (used.size >= targets) break;
    used.add(cell);
  }

  if (kind === 'near_symmetry' && targets >= 4 && used.size === targets) {
    const list = [...used];
    const axisCell = list.find((cell) => {
      const col = cell % size;
      return size % 2 === 0 || col !== Math.floor(size / 2);
    });
    if (axisCell != null) {
      used.delete(axisCell);
      const broken = shuffled(all.filter((cell) => !used.has(cell) && cell !== mirrorH(axisCell, size) && !used.has(mirrorH(cell, size))), rng);
      used.add(broken.length ? broken[0] : axisCell);
    }
  }

  return [...used].sort((a, b) => a - b);
}

function lineFraction(cells, size) {
  // Hai ô luôn "thẳng hàng" theo một nghĩa nào đó; chỉ tính từ 3 ô trở lên.
  if (cells.length < 3) return 0;
  const rows = new Map(), cols = new Map(), down = new Map(), up = new Map();
  for (const cell of cells) {
    const row = Math.floor(cell / size), col = cell % size;
    rows.set(row, (rows.get(row) || 0) + 1);
    cols.set(col, (cols.get(col) || 0) + 1);
    down.set(row - col, (down.get(row - col) || 0) + 1);
    up.set(row + col, (up.get(row + col) || 0) + 1);
  }
  const max = Math.max(...rows.values(), ...cols.values(), ...down.values(), ...up.values());
  return max / cells.length;
}

function symmetryPenalty(cells, size) {
  if (cells.length < 4) return 0;
  const set = new Set(cells);
  const transforms = [
    (cell) => mirrorH(cell, size),
    (cell) => (size - 1 - Math.floor(cell / size)) * size + (cell % size),
    (cell) => (size - 1 - Math.floor(cell / size)) * size + (size - 1 - (cell % size)),
  ];
  let best = 0;
  for (const transform of transforms) {
    const matches = cells.filter((cell) => set.has(transform(cell))).length / cells.length;
    best = Math.max(best, matches);
  }
  if (best >= 0.999) return 1;
  // Gần đối xứng là bẫy trí nhớ: nhớ nửa này rồi suy ra nửa kia sẽ sai 1-2 ô.
  if (best >= 0.6) return 0.3;
  return 0;
}

function blockPenalty(cells, size) {
  if (cells.length < 4) return 0;
  const rows = cells.map((cell) => Math.floor(cell / size));
  const cols = cells.map((cell) => cell % size);
  const height = Math.max(...rows) - Math.min(...rows) + 1;
  const width = Math.max(...cols) - Math.min(...cols) + 1;
  if (height * width !== cells.length) return 0;
  const set = new Set(cells);
  for (let r = Math.min(...rows); r <= Math.max(...rows); r++) {
    for (let c = Math.min(...cols); c <= Math.max(...cols); c++) if (!set.has(r * size + c)) return 0;
  }
  return 1;
}

function allCorners(cells, size) {
  const corners = new Set([0, size - 1, size * (size - 1), size * size - 1]);
  return cells.every((cell) => corners.has(cell));
}

function adjacency(cells, size) {
  if (cells.length < 2) return 0;
  const set = new Set(cells);
  let touching = 0;
  for (const cell of cells) {
    const row = Math.floor(cell / size), col = cell % size;
    if (set.has(cell - size) || set.has(cell + size) || (col > 0 && set.has(cell - 1)) || (col < size - 1 && set.has(cell + 1))) touching++;
  }
  return touching / cells.length;
}

/**
 * Heuristic 0..100 cho "pattern này khó nhớ tới đâu".
 *
 * Thành phần:
 * - information load: càng nhiều ô càng khó (tuyến tính, cap 34)
 * - spread: trải rộng khó hơn co cụm
 * - adjacency: dính nhau tạo chunk dễ nhớ → trừ điểm
 * - edge ratio: toàn ô viền dễ định vị → trừ điểm
 * - symmetry: đối xứng hoàn hảo rất dễ → trừ mạnh; gần đối xứng chỉ trừ nhẹ
 * - line/block: dạng hình học dễ mã hoá → trừ mạnh
 */
export function patternDifficulty(cells, size) {
  if (!Array.isArray(cells) || !cells.length) return 0;
  const total = size * size;
  const rows = cells.map((cell) => Math.floor(cell / size));
  const cols = cells.map((cell) => cell % size);
  const height = Math.max(...rows) - Math.min(...rows) + 1;
  const width = Math.max(...cols) - Math.min(...cols) + 1;
  const spread = Math.min(1, (height * width) / total);
  const edgeRatio = cells.filter((cell) => {
    const row = Math.floor(cell / size), col = cell % size;
    return row === 0 || col === 0 || row === size - 1 || col === size - 1;
  }).length / cells.length;
  const straight = lineFraction(cells, size);
  const straightPenalty = straight >= 0.999 ? 1 : straight >= 0.7 ? 0.5 : 0;
  const borderOnly = edgeRatio >= 0.999 ? 1 : 0;
  const corners = allCorners(cells, size) ? 1 : 0;
  const load = Math.min(34, cells.length * 3.2);
  const raw = 8 + load + spread * 18 + (1 - adjacency(cells, size)) * 14 + (1 - edgeRatio) * 8
    - symmetryPenalty(cells, size) * 18 - straightPenalty * 20 - blockPenalty(cells, size) * 14
    - borderOnly * 14 - corners * 16;
  return Math.max(0, Math.min(100, Math.round(raw * 10) / 10));
}

/** Ngưỡng tối thiểu để tránh "level 12 mà pattern dễ hơn level 3". */
export function patternFloor(level) {
  // Level 1-2 chủ ý không đặt ngưỡng: người mới cần pattern dễ mã hoá.
  return Math.min(66, Math.max(0, (level - 1) * 4.8));
}

/**
 * Sinh pattern tất định cho một challenge.
 * Thử nhiều lượt rồi chọn pattern khó nhất đạt ngưỡng của level.
 */
export function buildMemoryPattern(rng, size, targets, level, attempts = 14) {
  const floor = patternFloor(level);
  // 6% "easy slot": giữ line/corners/block xuất hiện ở mọi nấc.
  // Yêu cầu sản phẩm là GIẢM tần suất, không loại bỏ hoàn toàn.
  if (rng() < 0.06) {
    const kind = ['line', 'corners', 'block'][Math.floor(rng() * 3)];
    const cells = buildCells(kind, rng, size, targets);
    if (cells.length === targets) return { kind, cells, difficulty: patternDifficulty(cells, size) };
  }
  let best = null;
  let bestScore = -1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const kind = pickWeighted(patternWeights(level), rng);
    const cells = buildCells(kind, rng, size, targets);
    if (cells.length !== targets) continue;
    const difficulty = patternDifficulty(cells, size);
    if (difficulty > bestScore) {
      bestScore = difficulty;
      best = { kind, cells, difficulty };
    }
    if (difficulty >= floor) return { kind, cells, difficulty };
  }
  if (!best) {
    const cells = buildCells('scattered', rng, size, targets);
    best = { kind: 'scattered', cells, difficulty: patternDifficulty(cells, size) };
  }
  return best;
}

/** Dùng cho test/report: mô phỏng số vòng đạt được trong 60 giây. */
export function simulateMemoryRun({ durationMs = 60000, responseMs = (level) => 1400 - level * 40, maxRounds = 120 } = {}) {
  let at = 0;
  const rounds = [];
  for (let index = 0; index < maxRounds; index++) {
    const level = memoryLevel(index);
    const start = index ? at + level.restMs : at;
    const selectAt = start + level.prepareMs + level.revealMs + level.hideMs;
    const response = Math.max(420, Math.min(level.selectMs - 100, responseMs(level.level)));
    const submitAt = selectAt + response;
    if (submitAt > durationMs) break;
    rounds.push({ index, level: level.level, stage: level.stage, size: level.size, targets: level.targets, revealMs: level.revealMs, selectMs: level.selectMs, submitAt });
    at = submitAt;
  }
  return rounds;
}

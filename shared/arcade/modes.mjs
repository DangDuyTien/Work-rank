/**
 * Canonical arcade mode registry.
 *
 * Một nguồn duy nhất cho capacity, team size và cách chia đội. Frontend,
 * backend và engine đều đọc từ đây; không rải magic number 1/2/3/4/6 ra
 * nhiều file.
 *
 * Quy ước tên:
 * - `1V1` = 2 người thật, 1 đấu 1.
 * - `2V2` = 4 người thật, 2 đấu 2.
 * - `3V3` = 6 người thật, 3 đấu 3.
 * - `TRIO` = 3 người thật, free-for-all. Đây KHÔNG phải 3v3.
 *
 * `DUO` là tên cũ của `1V1`; chỉ còn tồn tại trong dữ liệu cũ và được
 * chuẩn hoá qua `canonicalMode`.
 */

export const GAME_MODES = Object.freeze({
  SOLO: Object.freeze({
    id: 'SOLO',
    label: 'Solo',
    short: '01',
    capacity: 1,
    teamSize: 0,
    teamMode: false,
    versus: false,
    description: 'Một mình, một kỷ lục mới.',
  }),
  ONE_V_ONE: Object.freeze({
    id: '1V1',
    label: '1v1',
    short: '02',
    capacity: 2,
    teamSize: 1,
    teamMode: false,
    versus: true,
    description: '2 người · 1 đấu 1.',
  }),
  TRIO: Object.freeze({
    id: 'TRIO',
    label: 'Trio',
    short: '03',
    capacity: 3,
    teamSize: 0,
    teamMode: false,
    versus: true,
    description: '3 người · tranh hạng tự do.',
  }),
  TWO_V_TWO: Object.freeze({
    id: '2V2',
    label: '2v2',
    short: '04',
    capacity: 4,
    teamSize: 2,
    teamMode: true,
    versus: true,
    description: '4 người · 2 đấu 2.',
  }),
  THREE_V_THREE: Object.freeze({
    id: '3V3',
    label: '3v3',
    short: '06',
    capacity: 6,
    teamSize: 3,
    teamMode: true,
    versus: true,
    description: '6 người · 3 đấu 3.',
  }),
});

export const MODE_IDS = Object.freeze(Object.values(GAME_MODES).map((mode) => mode.id));

const ALIASES = Object.freeze({
  DUO: '1V1',
  '1V1': '1V1',
  '1v1': '1V1',
  '2V2': '2V2',
  '2v2': '2V2',
  '3V3': '3V3',
  '3v3': '3V3',
  SOLO: 'SOLO',
  solo: 'SOLO',
  TRIO: 'TRIO',
  trio: 'TRIO',
});

/** Chuẩn hoá mode từ DB/API/URL. Trả null nếu không hợp lệ. */
export function canonicalMode(value) {
  const raw = String(value ?? '').trim();
  return ALIASES[raw] || ALIASES[raw.toUpperCase()] || null;
}

export function modeSpec(value) {
  const id = canonicalMode(value);
  return id ? GAME_MODES[Object.keys(GAME_MODES).find((key) => GAME_MODES[key].id === id)] : null;
}

export function capacityFor(value) {
  return modeSpec(value)?.capacity ?? 0;
}

export function isTeamMode(value) {
  return Boolean(modeSpec(value)?.teamMode);
}

/** Mode dùng để lọc BXH (đã chuẩn hoá, giữ nguyên thứ tự sản phẩm). */
export const LEADERBOARD_MODES = Object.freeze(MODE_IDS);

export const TEAM_IDS = Object.freeze(['A', 'B']);

export function teamLabel(team) {
  return `TEAM ${team}`;
}

/**
 * Chia đội cân bằng: luôn xếp vào đội đang ít người hơn, hoà thì A trước.
 * Với 2v2 cho A,B,A,B; 3v3 cho A,B,A,B,A,B.
 */
export function balancedTeam(players = [], spec = null) {
  if (!spec?.teamMode) return null;
  const counts = { A: 0, B: 0 };
  for (const player of players) {
    const team = player?.team;
    if (team === 'A' || team === 'B') counts[team]++;
  }
  return counts.A <= counts.B ? 'A' : 'B';
}

export function teamCounts(players = []) {
  const counts = { A: 0, B: 0 };
  for (const player of players) {
    if (player?.team === 'A' || player?.team === 'B') counts[player.team]++;
  }
  return counts;
}

export function teamsAreBalanced(players = [], spec = null) {
  if (!spec?.teamMode) return true;
  const counts = teamCounts(players);
  return counts.A === spec.teamSize && counts.B === spec.teamSize;
}

/**
 * Điểm đội.
 *
 * 75% trung bình + 25% người thấp điểm nhất + thưởng chính xác tối đa 300.
 * Thành phần "người thấp nhất" là chủ ý: một pro không thể gánh cả đội,
 * vì đội [5000, 0] thua đội [2500, 2500] dù tổng bằng nhau.
 */
export function teamScore(entries = []) {
  const list = entries.filter(Boolean);
  if (!list.length) return 0;
  const scores = list.map((entry) => Math.max(0, Number(entry.score) || 0));
  // Chưa trả lời vòng nào thì accuracy mặc định 100 không được cộng thưởng,
  // nếu không cả hai đội khởi đầu với 300 điểm ảo.
  const accuracies = list.map((entry) => Number(entry.attempts) > 0 ? Math.max(0, Math.min(100, Number(entry.accuracy) || 0)) : 0);
  const average = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  const floor = Math.min(...scores);
  const accuracy = accuracies.reduce((sum, value) => sum + value, 0) / accuracies.length;
  return Math.round(average * 0.75 + floor * 0.25 + accuracy * 3);
}

export function compareTeams(a, b) {
  return (b.score - a.score)
    || (b.correct - a.correct)
    || (b.accuracy - a.accuracy)
    || String(a.id).localeCompare(String(b.id));
}

/**
 * Tổng hợp đội từ danh sách player đã có `metrics` (hoặc `result`).
 * Trả [] cho mode không phải team để UI không phải rẽ nhánh nhiều lần.
 */
export function aggregateTeams(mode, players = []) {
  const spec = modeSpec(mode);
  if (!spec?.teamMode) return [];
  return TEAM_IDS.map((id) => {
    const roster = players.filter((player) => player.team === id);
    const entries = roster.map((player) => player.result || player.metrics || {});
    const score = teamScore(entries);
    const correct = entries.reduce((sum, entry) => sum + (Number(entry.correct) || 0), 0);
    const attempts = entries.reduce((sum, entry) => sum + (Number(entry.attempts) || 0), 0);
    const accuracy = attempts ? Math.round((correct / attempts) * 10000) / 100 : 0;
    return {
      id,
      label: teamLabel(id),
      size: roster.length,
      teamSize: spec.teamSize,
      complete: roster.length === spec.teamSize,
      score,
      correct,
      attempts,
      accuracy,
      players: roster.map((player) => {
        const entry = player.result || player.metrics || {};
        return {
          id: player.id,
          userId: player.userId,
          name: player.name,
          team: id,
          score: Number(entry.score) || 0,
          correct: Number(entry.correct) || 0,
          attempts: Number(entry.attempts) || 0,
          accuracy: Number(entry.accuracy) || 0,
          lastCorrect: entry.lastCorrect ?? null,
          combo: Number(entry.combo) || 0,
          finishedAt: player.finishedAt || null,
        };
      }),
    };
  });
}

export function teamOutcome(mode, players = []) {
  const teams = aggregateTeams(mode, players).sort(compareTeams);
  if (!teams.length) return null;
  const [first, second] = teams;
  const tie = first.score === second.score;
  return {
    winner: tie ? null : first.id,
    tie,
    teams: teams.map((team, index) => ({ ...team, rank: tie ? 1 : index + 1 })),
  };
}

'use strict';
const crypto = require('node:crypto');
const { Op } = require('sequelize');
const { ArcadeRoom: Room, ArcadePlayer: Player, User, Season, ScoreLedger } = require('../models');
const transaction = require('./typingTransaction');
const { ValidationError, NotFoundError, ForbiddenError } = require('../utils/errors');
const engine = import('../../../shared/arcade/engine.mjs');
const GRACE_MS = 30000;
const DELIVERY_MS = 10000;
// Số trận gần nhất dùng để chọn seed tránh lặp từ (Computer Rush).
const RECENT_MATCH_COUNT = 2;
const rulesFor = (room) => ({ durationMs: room.durationSeconds * 1000, difficulty: room.difficulty, rulesVersion: room.rulesVersion || 1 });
let io, sweepTimer;

function logLifecycle(action, room, userId) {
  if (process.env.NODE_ENV === 'production') return;
  console.info('[room-lifecycle]', JSON.stringify({
    event: `ROOM_${action}`,
    roomId: room?.id,
    gameType: room?.gameType,
    mode: room?.mode,
    userId: userId == null ? null : String(userId),
    state: room?.status,
  }));
}

/**
 * ID challenge của các trận Computer Rush gần nhất của người chơi.
 *
 * Chỉ là tối ưu chống lặp: seed cuối cùng vẫn do server chọn và lưu, nên mọi
 * người trong Duo/Trio nhận đúng cùng chuỗi; không client nào tự random.
 */
async function recentComputerChallengeIds(userId, transaction) {
  const rows = await Player.findAll({
    where: { userId, finishedAt: { [Op.ne]: null } },
    include: [{ model: Room, where: { gameType: 'computer_rush' }, attributes: ['seed', 'difficulty', 'rulesVersion'] }],
    order: [['createdAt', 'DESC']],
    limit: RECENT_MATCH_COUNT,
    transaction,
  });
  const { computerSequenceIds } = await engine;
  const ids = new Set();
  for (const row of rows) {
    const room = row.ArcadeRoom || row.room;
    if (!room?.seed) continue;
    for (const id of computerSequenceIds(room.seed, room.difficulty || 'mixed', 60)) ids.add(id);
  }
  return [...ids];
}

async function pickSeed({ gameType, difficulty, userId, transaction }) {
  const fallback = () => crypto.randomBytes(16).toString('hex');
  if (gameType !== 'computer_rush') return fallback();
  const { chooseComputerSeed } = await engine;
  return chooseComputerSeed({
    recentIds: await recentComputerChallengeIds(userId, transaction),
    difficulty,
    randomSeed: fallback,
  });
}

async function roomLocked(id, t) {
  const room = await Room.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
  if (!room) throw new NotFoundError('Không tìm thấy phòng arcade');
  return room;
}
async function members(room, t) {
  return Player.findAll({ where: { roomId: room.id }, include: [{ model: User, attributes: ['id', 'name', 'avatarUrl'] }], order: [['createdAt', 'ASC'], ['id', 'ASC']], transaction: t });
}
async function createRoomWithHost(roomData, userId, t, { ready = false, team = null } = {}) {
  const room = await Room.create(roomData, { transaction: t });
  await Player.create({ id: crypto.randomUUID(), roomId: room.id, userId, team, heartbeatAt: new Date(), ready }, { transaction: t });
  return room;
}
function mine(players, userId) {
  const p = players.find((x) => String(x.userId) === String(userId));
  if (!p) throw new ForbiddenError('Bạn không ở trong phòng này');
  return p;
}
async function pack(room, players, userId) {
  const { replay, compareResults, aggregateTeams, modeSpec } = await engine;
  const spec = modeSpec(room.mode);
  const decorated = players.map((p, position) => ({
    p, position: position + 1,
    metrics: p.result || replay(room.gameType, room.seed, p.events, rulesFor(room)),
  }));
  const ranked = decorated.filter((d) => d.p.result).map((d) => ({ ...d.p.result, id: d.p.id })).sort(compareResults);
  const teams = aggregateTeams(room.mode, decorated.map((d) => ({
    id: d.p.id, userId: d.p.userId, name: d.p.User?.name || 'Người chơi', team: d.p.team,
    finishedAt: d.p.finishedAt, result: d.p.result, metrics: d.metrics,
  })));
  return {
    room: { ...room.toJSON(), teamMode: Boolean(spec?.teamMode), teamSize: spec?.teamSize || 0, modeLabel: spec?.label || room.mode },
    serverNow: Date.now(), teams,
    players: decorated.map(({ p, position, metrics }) => ({
      id: p.id, userId: p.userId, name: p.User?.name || 'Người chơi', avatarUrl: p.User?.avatarUrl,
      position, team: p.team || null, ready: p.ready, revision: p.revision, connected: Date.now() - new Date(p.heartbeatAt).getTime() < GRACE_MS,
      finishedAt: p.finishedAt, result: p.result, rank: p.result ? ranked.findIndex((r) => r.id === p.id) + 1 : null,
      metrics,
      ...(String(p.userId) === String(userId) ? { events: p.events } : {}),
    })),
  };
}
async function changed(roomId) {
  if (!io) return;
  const room = await Room.findByPk(roomId);
  if (!room) return;
  const players = await members(room);
  for (const p of players) io.to(`user:${p.userId}`).emit('arcade:state', await pack(room, players, p.userId));
  io.to('dashboard').emit('arcade:roomsChanged', { gameType: room.gameType });
}
async function mutate(id, userId, work, { allowAbsent = false } = {}) {
  const result = await transaction(async (t) => {
    const room = await roomLocked(id, t);
    const players = await members(room, t);
    if (allowAbsent && !players.some((p) => String(p.userId) === String(userId))) return { left: true };
    const p = mine(players, userId);
    await work(room, players, p, t);
    room.revision++;
    await room.save({ transaction: t });
    return pack(room, players, userId);
  });
  await changed(id);
  return result;
}
/**
 * Cấp XP đúng một lần cho mỗi ArcadePlayer.
 *
 * `idempotencyKey` là duy nhất theo player, nên retry finalize / double click
 * / sweep chồng nhau đều không tạo bản ghi thứ hai. Team mode cũng đi qua
 * đây sau khi đã biết kết quả đội, nên bonus thắng đội không bị cộng lặp.
 */
async function grantXp(room, p, awardedXp, t) {
  if (!awardedXp) return;
  const idempotencyKey = `arcade:${p.id}`;
  const existing = await ScoreLedger.findOne({ where: { idempotencyKey }, transaction: t });
  if (existing) return;
  const user = await User.findByPk(p.userId, { transaction: t });
  const season = await Season.findOne({ where: { status: 'ACTIVE' }, order: [['id', 'DESC']], transaction: t });
  await ScoreLedger.create({ idempotencyKey, effectType: 'INDIVIDUAL_XP', pointsDelta: awardedXp, userId: p.userId, teamId: user.teamId, seasonId: season?.id || null, eventId: crypto.randomUUID(), reason: `${room.gameType} — lượt chơi đã xác minh`, metadata: p.result }, { transaction: t });
}
async function settle(room, p, t, { forfeited = false } = {}) {
  if (p.finishedAt) return;
  const { replay, modeSpec } = await engine;
  const metrics = replay(room.gameType, room.seed, p.events, rulesFor(room));
  const eligible = !forfeited && metrics.correct > 0 && metrics.accuracy >= 50;
  const spec = modeSpec(room.mode);
  const teamMode = Boolean(spec?.teamMode);
  // Team mode trả thưởng sau khi biết đội thắng, để bonus chỉ được cộng một lần.
  const awardedXp = eligible && !teamMode ? Math.min(30, Math.floor(metrics.score / 200)) : 0;
  const earlier = await Player.findAll({ where: { userId: p.userId, finishedAt: { [Op.ne]: null } }, include: [{ model: Room, where: { gameType: room.gameType, mode: room.mode, difficulty: room.difficulty, durationSeconds: room.durationSeconds, rulesVersion: room.rulesVersion || 1 } }], transaction: t });
  const previousBestScore = earlier.reduce((best, x) => x.result?.eligible ? Math.max(best, Number(x.result.score || 0)) : best, 0);
  const finishedAt = new Date();
  p.result = { ...metrics, userId: p.userId, startedAt: room.startedAt ? new Date(room.startedAt).toISOString() : null, finishedAt: finishedAt.toISOString(), validatedAt: finishedAt.toISOString(), createdAt: new Date(p.createdAt).toISOString(), awardedXp, eligible, forfeited, attemptId: room.id, playerAttemptId: p.id, mode: room.mode, gameType: room.gameType, team: p.team || null, teamMode, teamPending: teamMode && eligible,
    previousBestScore, personalBestScore: eligible ? Math.max(previousBestScore, metrics.score) : previousBestScore,
    isPersonalBest: eligible && metrics.score > previousBestScore, improvement: metrics.score - previousBestScore };
  p.finishedAt = finishedAt;
  if (awardedXp) await grantXp(room, p, awardedXp, t);
  await p.save({ transaction: t });
}
async function closeIfFinished(room, players, t) {
  if (!players.every((p) => p.finishedAt)) return;
  if (room.status === 'FINISHED') return;
  room.status = 'FINISHED';
  const { compareResults, modeSpec, teamOutcome } = await engine;
  const ranked = [...players].sort((a,b)=>compareResults({...a.result,id:a.id},{...b.result,id:b.id}));
  for (let i=0;i<ranked.length;i++) {
    ranked[i].result = { ...ranked[i].result, rank: i+1 };
    await ranked[i].save({transaction:t});
  }
  const spec = modeSpec(room.mode);
  if (spec?.teamMode) {
    const outcome = teamOutcome(room.mode, players.map((p) => ({ id: p.id, userId: p.userId, name: p.User?.name, team: p.team, finishedAt: p.finishedAt, result: p.result })));
    for (const p of players) {
      const team = outcome.teams.find((entry) => entry.id === p.team);
      const eligible = Boolean(p.result?.eligible);
      const base = eligible ? Math.min(30, Math.floor(Number(p.result.score || 0) / 200)) : 0;
      const bonus = eligible && outcome.winner === p.team && !outcome.tie ? 6 : 0;
      p.result = { ...p.result, team: p.team, teamScore: team?.score || 0, teamRank: team?.rank || null,
        teamWon: Boolean(outcome.winner === p.team && !outcome.tie), teamSize: spec.teamSize,
        teamTotal: team?.score || 0, teamAccuracy: team?.accuracy || 0, awardedXp: base + bonus, teamPending: false };
      await grantXp(room, p, base + bonus, t);
      await p.save({transaction:t});
    }
  }
  logLifecycle('CLOSE', room, null);
}
async function sweep() {
  const rooms = await Room.findAll({ where: { status: { [Op.in]: ['WAITING', 'PLAYING'] } }, attributes: ['id'] });
  for (const entry of rooms) {
    let modified = false;
    await transaction(async (t) => {
      const room = await roomLocked(entry.id, t);
      const players = await members(room, t);
      if (room.status === 'WAITING') {
        const stale = players.filter((p) => Date.now() - new Date(p.heartbeatAt).getTime() > GRACE_MS);
        for (const p of stale) await p.destroy({ transaction: t });
        const left = players.filter((p) => !stale.includes(p));
        if (stale.length || !left.length) {
          room.status = left.length ? 'WAITING' : 'CLOSED';
          if (left.length && !left.some((p) => String(p.userId) === String(room.hostId))) room.hostId = left[0].userId;
          for (const p of left) { p.ready = false; await p.save({ transaction: t }); }
          modified = true;
          if (room.status === 'CLOSED') logLifecycle('CLOSE', room, null);
        }
      } else if (room.status === 'PLAYING' && Date.now() >= new Date(room.startedAt).getTime() + room.durationSeconds * 1000 + DELIVERY_MS) {
        for (const p of players) await settle(room, p, t);
        await closeIfFinished(room, players, t);
        modified = true;
      }
      if (modified) { room.revision++; await room.save({ transaction: t }); }
    });
    if (modified) await changed(entry.id);
  }
}
function start(ioInstance) {
  io = ioInstance;
  ioInstance.httpServer?.once('close', () => { if (io === ioInstance) stop(); });
  if (sweepTimer) clearInterval(sweepTimer);
  sweepTimer = setInterval(() => sweep().catch((e) => console.error('[Arcade sweep]', e.message)), 5000);
  sweepTimer.unref();
}
function stop() { clearInterval(sweepTimer); sweepTimer = null; io = null; }

async function create(data, user) {
  const { GAME_TYPES, canonicalMode, modeSpec, rulesVersionFor } = await engine;
  const { gameType, difficulty = 'mixed' } = data;
  const mode = canonicalMode(data.mode);
  const spec = modeSpec(mode);
  if (!GAME_TYPES.includes(gameType) || !spec || !['mixed', 'easy', 'medium', 'hard', 'vietnamese'].includes(difficulty)) throw new ValidationError('Game, chế độ hoặc độ khó không hợp lệ');
  const result = await transaction(async (t) => {
    await User.findByPk(user.id, { transaction: t, lock: t.LOCK.UPDATE });
    const active = await Player.findAll({ where: { userId: user.id, finishedAt: null }, include: [{ model: Room, where: { status: { [Op.in]: ['WAITING', 'PLAYING'] } } }], transaction: t });
    if (active.length) throw new ValidationError('Hãy hoàn thành hoặc rời phòng hiện tại trước khi tạo lượt mới');
    const durationSeconds = Number(process.env.ARCADE_ROUND_SECONDS || 60);
    if (!Number.isInteger(durationSeconds) || durationSeconds < 5 || durationSeconds > 300) throw new Error('ARCADE_ROUND_SECONDS must be 5..300');
    const rulesVersion = rulesVersionFor(gameType);
    const seed = await pickSeed({ gameType, difficulty, userId: user.id, transaction: t });
    const room = await createRoomWithHost({ id: crypto.randomUUID(), gameType, mode, difficulty, capacity: spec.capacity, hostId: user.id, title: `${user.name} · ${mode}`.slice(0, 100), seed, durationSeconds, rulesVersion, status: mode === 'SOLO' ? 'PLAYING' : 'WAITING', startedAt: mode === 'SOLO' ? new Date(Date.now() + 3200) : null }, user.id, t, { ready: mode === 'SOLO', team: spec.teamMode ? 'A' : null });
    return pack(room, await members(room, t), user.id);
  });
  logLifecycle('CREATE', result.room, user.id);
  await changed(result.room.id);
  return result;
}
async function list(gameType, mode) {
  const { GAME_TYPES, canonicalMode, modeSpec } = await engine;
  const canonical = canonicalMode(mode);
  const spec = modeSpec(canonical);
  if (!GAME_TYPES.includes(gameType) || !spec || spec.id === 'SOLO') throw new ValidationError('Bộ lọc phòng không hợp lệ');
  await sweep();
  const rooms = await Room.findAll({ where: { gameType, mode: canonical, status: 'WAITING' }, include: [{ model: Player, as: 'players', required: true, attributes: ['userId', 'team'], include: [{ model: User, attributes: ['name'] }] }], order: [['createdAt', 'DESC']], limit: 50 });
  return rooms.map((r) => ({ id: r.id, gameType: r.gameType, mode: r.mode, title: r.title, capacity: r.capacity, players: r.players.length, teams: spec.teamMode ? { A: r.players.filter((p) => p.team === 'A').length, B: r.players.filter((p) => p.team === 'B').length } : null, host: r.players.find((p) => String(p.userId) === String(r.hostId))?.User?.name, status: r.status }));
}
async function join(id, userId) {
  const result = await transaction(async (t) => {
    await User.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
    const room = await roomLocked(id, t);
    const players = await members(room, t);
    if (players.some((p) => String(p.userId) === String(userId))) return pack(room, players, userId);
    if (room.mode === 'SOLO') throw new ValidationError('Không thể tham gia lượt chơi SOLO');
    if (['CLOSED', 'FINISHED'].includes(room.status)) throw new NotFoundError('Phòng không còn tồn tại');
    if (room.status !== 'WAITING') throw new ValidationError('Phòng đã bắt đầu');
    if (players.length >= room.capacity) throw new ValidationError('Phòng đã đầy');
    const active = await Player.findOne({ where: { userId, finishedAt: null }, include: [{ model: Room, where: { status: { [Op.in]: ['WAITING', 'PLAYING'] } } }], transaction: t });
    if (active) throw new ValidationError('Bạn đang ở một phòng khác');
    const { modeSpec, balancedTeam } = await engine;
    const spec = modeSpec(room.mode);
    const team = spec?.teamMode ? balancedTeam(players, spec) : null;
    await Player.create({ id: crypto.randomUUID(), roomId: id, userId, team, heartbeatAt: new Date() }, { transaction: t });
    for (const p of players) { p.ready = false; await p.save({ transaction: t }); }
    room.revision++;
    await room.save({ transaction: t });
    return pack(room, await members(room, t), userId);
  });
  logLifecycle('JOIN', result.room, userId);
  await changed(id);
  return result;
}
/**
 * Đổi đội trước khi bắt đầu. Mọi người bị reset ready vì đội hình đã đổi —
 * tránh trường hợp 3 người đã ready rồi một người nhảy đội và trận start sai.
 */
async function switchTeam(id, userId, team) {
  if (team !== 'A' && team !== 'B') throw new ValidationError('Đội không hợp lệ');
  const result = await mutate(id, userId, async (room, players, p, t) => {
    const { modeSpec, teamCounts } = await engine;
    const spec = modeSpec(room.mode);
    if (!spec?.teamMode) throw new ValidationError('Chế độ này không chia đội');
    if (room.status !== 'WAITING') throw new ValidationError('Trận đấu đã bắt đầu');
    if (p.team === team) return;
    if (teamCounts(players)[team] >= spec.teamSize) throw new ValidationError(`TEAM ${team} đã đủ ${spec.teamSize} người`);
    p.team = team;
    await p.save({ transaction: t });
    for (const other of players) { other.ready = false; await other.save({ transaction: t }); }
  });
  logLifecycle('TEAM', result.room, userId);
  return result;
}
async function detail(id, userId) {
  return transaction(async (t) => {
    const room = await roomLocked(id, t);
    const players = await members(room, t), p = mine(players, userId);
    p.heartbeatAt = new Date();
    await p.save({ transaction: t });
    return pack(room, players, userId);
  });
}
async function ready(id, userId, value) {
  if (typeof value !== 'boolean') throw new ValidationError('Trạng thái sẵn sàng không hợp lệ');
  const result = await mutate(id, userId, async (room, players, p, t) => {
    if (room.status !== 'WAITING') throw new ValidationError('Trận đấu đã bắt đầu');
    p.ready = value; p.heartbeatAt = new Date(); await p.save({ transaction: t });
  });
  logLifecycle('READY', result.room, userId);
  return result;
}
async function begin(id, userId) {
  const result = await mutate(id, userId, async (room, players) => {
    if (String(room.hostId) !== String(userId)) throw new ForbiddenError('Chỉ chủ phòng được bắt đầu');
    const { modeSpec, teamsAreBalanced } = await engine;
    const spec = modeSpec(room.mode);
    const everyoneReady = players.length === room.capacity && players.every((p) => p.ready && Date.now() - new Date(p.heartbeatAt).getTime() <= GRACE_MS);
    // 2v2 phải là 2+2, 3v3 phải là 3+3. Không cho start 3 vs 1.
    if (!everyoneReady || !teamsAreBalanced(players, spec)) throw new ValidationError(spec?.teamMode ? 'Cần đủ người, chia đều hai đội và tất cả sẵn sàng' : 'Cần đủ người và tất cả sẵn sàng');
    room.status = 'PLAYING'; room.startedAt = new Date(Date.now() + 3200);
  });
  logLifecycle('START', result.room, userId);
  return result;
}
async function accept(room, p, data) {
  const { replay, sameArcadeEvent } = await engine;
  if (data.seed !== room.seed || data.attemptId !== room.id) throw new ValidationError('Seed hoặc attempt ID không hợp lệ');
  if (!Number.isSafeInteger(data.revision) || data.revision < 0 || !Array.isArray(data.events)) throw new ValidationError('Revision không hợp lệ');
  if (data.revision <= p.revision) return;
  if (data.revision !== data.events.length || data.events.length < p.events.length || p.events.some((e, i) => !sameArcadeEvent(e, data.events[i]))) throw new ValidationError('Không được thay đổi lịch sử đã đồng bộ');
  const elapsedMs = Date.now() - new Date(room.startedAt).getTime();
  if (elapsedMs < 0) throw new ValidationError('Chưa GO!');
  if (elapsedMs > room.durationSeconds * 1000 + DELIVERY_MS) return;
  try { replay(room.gameType, room.seed, data.events, { ...rulesFor(room), elapsedMs }); }
  catch (e) { throw new ValidationError(e.message); }
  p.events = data.events; p.revision = data.revision;
}
async function sync(id, userId, data, finish = false) {
  return mutate(id, userId, async (room, players, p, t) => {
    if (p.finishedAt) return;
    if (room.status !== 'PLAYING') throw new ValidationError('Trận đấu chưa bắt đầu');
    await accept(room, p, data);
    p.heartbeatAt = new Date();
    if (finish) {
      if (Date.now() < new Date(room.startedAt).getTime() + room.durationSeconds * 1000) throw new ValidationError('Lượt chơi chưa hết giờ');
      await settle(room, p, t);
      await closeIfFinished(room, players, t);
    } else await p.save({ transaction: t });
  });
}
async function leave(id, userId) {
  const result = await mutate(id, userId, async (room, players, p, t) => {
    if (room.status === 'WAITING') {
      await p.destroy({ transaction: t }); players.splice(players.indexOf(p), 1);
      if (!players.length) room.status = 'CLOSED';
      else {
        if (String(room.hostId) === String(userId)) room.hostId = players[0].userId;
        for (const x of players) { x.ready = false; await x.save({ transaction: t }); }
      }
    } else if (room.status === 'PLAYING') { await settle(room, p, t, { forfeited: true }); await closeIfFinished(room, players, t); }
  }, { allowAbsent: true });
  if (!result.left) {
    logLifecycle('LEAVE', result.room, userId);
    if (result.room.status === 'CLOSED') logLifecycle('CLOSE', result.room, userId);
  }
  return result;
}
async function active(userId) {
  const p = await Player.findOne({ where: { userId, finishedAt: null }, include: [{ model: Room, where: { status: { [Op.in]: ['WAITING', 'PLAYING'] } } }], order: [['createdAt', 'DESC']] });
  return p ? detail(p.roomId, userId) : null;
}
async function rematch(id, user) {
  const { rulesVersionFor, modeSpec, balancedTeam } = await engine;
  const result = await transaction(async (t) => {
    await User.findByPk(user.id, { transaction: t, lock: t.LOCK.UPDATE });
    const old = await roomLocked(id, t);
    const oldPlayers = await members(old, t);
    mine(oldPlayers, user.id);
    if (old.status !== 'FINISHED') throw new ValidationError('Chờ tất cả người chơi hoàn thành để chơi lại');
    const spec = modeSpec(old.mode);
    // Giữ đội cũ khi chơi lại cùng nhóm; người mới (nếu có) được chia cân bằng.
    const previousTeam = new Map(oldPlayers.map((p) => [String(p.userId), p.team || null]));
    let next = old.rematchId ? await Room.findByPk(old.rematchId, { transaction: t, lock: t.LOCK.UPDATE }) : null;
    const active = await Player.findOne({ where: { userId: user.id, finishedAt: null }, include: [{ model: Room, where: { status: { [Op.in]: ['WAITING', 'PLAYING'] } } }], transaction: t });
    if (active && active.roomId !== next?.id) throw new ValidationError('Bạn đang có một lượt chơi khác');
    if (!next || !['WAITING', 'PLAYING'].includes(next.status)) {
      const nextRulesVersion = rulesVersionFor(old.gameType);
      const seed = await pickSeed({ gameType: old.gameType, difficulty: old.difficulty, userId: user.id, transaction: t });
      next = await createRoomWithHost({ id: crypto.randomUUID(), gameType: old.gameType, mode: old.mode, difficulty: old.difficulty, capacity: old.capacity, durationSeconds: old.durationSeconds,
        rulesVersion: nextRulesVersion, seed, hostId: user.id, title: `${user.name} · ${old.mode}`.slice(0, 100), status: old.mode === 'SOLO' ? 'PLAYING' : 'WAITING', startedAt: old.mode === 'SOLO' ? new Date(Date.now() + 3200) : null }, user.id, t, { ready: old.mode === 'SOLO', team: spec?.teamMode ? previousTeam.get(String(user.id)) || 'A' : null });
      old.rematchId = next.id; old.revision++; await old.save({ transaction: t });
    }
    const nextPlayers = await members(next, t);
    if (!nextPlayers.some((p) => String(p.userId) === String(user.id))) {
      if ((next.status !== 'WAITING' && next.mode !== 'SOLO') || nextPlayers.length >= next.capacity) throw new ValidationError('Ván tiếp theo đã đầy hoặc đã bắt đầu');
      let team = null;
      if (spec?.teamMode) {
        const counts = { A: 0, B: 0 };
        for (const p of nextPlayers) if (p.team === 'A' || p.team === 'B') counts[p.team]++;
        const wanted = previousTeam.get(String(user.id));
        team = wanted && counts[wanted] < spec.teamSize ? wanted : balancedTeam(nextPlayers, spec);
      }
      await Player.create({ id: crypto.randomUUID(), roomId: next.id, userId: user.id, team, heartbeatAt: new Date(), ready: next.mode === 'SOLO' }, { transaction: t });
      for (const p of nextPlayers) { p.ready = false; await p.save({ transaction: t }); }
      next.revision++; await next.save({ transaction: t });
    }
    return pack(next, await members(next, t), user.id);
  });
  await changed(id); await changed(result.room.id);
  return result;
}
async function leaderboard(gameType, mode, period, userId, difficulty = 'mixed') {
  const { GAME_TYPES, canonicalMode, compareResults, rulesVersionFor } = await engine;
  const canonical = canonicalMode(mode);
  if (!GAME_TYPES.includes(gameType) || !canonical || !['today', 'week', 'month', 'all'].includes(period) || !['mixed', 'easy', 'medium', 'hard', 'vietnamese'].includes(difficulty)) throw new ValidationError('Bộ lọc BXH không hợp lệ');
  const now = new Date();
  // WorkRank arcade periods use the product's Asia/Ho_Chi_Minh calendar.
  const local = new Date(now.getTime() + 7 * 3600000);
  local.setUTCHours(0, 0, 0, 0);
  if (period === 'week') local.setUTCDate(local.getUTCDate() - (local.getUTCDay() + 6) % 7);
  if (period === 'month') local.setUTCDate(1);
  const where = { finishedAt: period === 'all' ? { [Op.ne]: null } : { [Op.gte]: new Date(local.getTime() - 7 * 3600000) } };
  const durationSeconds = Number(process.env.ARCADE_ROUND_SECONDS || 60);
  const rows = await Player.findAll({ where, include: [{ model: Room, where: { gameType, mode: canonical, durationSeconds, rulesVersion: rulesVersionFor(gameType), ...(gameType === 'computer_rush' ? { difficulty } : {}) } }, { model: User, attributes: ['name', 'avatarUrl'] }] });
  const best = new Map();
  for (const p of rows) {
    if (!p.result?.eligible) continue;
    const entry = { ...p.result, id: p.id, userId: p.userId, name: p.User?.name, avatarUrl: p.User?.avatarUrl };
    const previous = best.get(String(p.userId));
    if (!previous || compareResults(entry, previous) < 0) best.set(String(p.userId), entry);
  }
  const ranked = [...best.values()].sort(compareResults).map((x, i) => ({ ...x, rank: i + 1 }));
  return { rows: ranked.slice(0, 100), personal: ranked.find((x) => String(x.userId) === String(userId)) || null, gameType, mode: canonical, period, durationSeconds, rulesVersion: rulesVersionFor(gameType) };
}

async function history(userId, { gameType, limit = 20 } = {}) {
  const { GAME_TYPES, compareResults } = await engine;
  if (gameType && !GAME_TYPES.includes(gameType)) throw new ValidationError('Game không hợp lệ');
  const rows = await Player.findAll({ where: { userId, finishedAt: { [Op.ne]: null } },
    include: [{ model: Room, ...(gameType ? {where:{gameType}} : {}), include: [{model:Player,as:'players',attributes:['id','result']}] }],
    order:[['finishedAt','DESC'],['id','DESC']],limit:Math.min(50,Math.max(1,Number(limit)||20)) });
  return { attempts: rows.map(p => {
    const room=p.ArcadeRoom;
    const ranked=room.players.filter(x=>x.result).sort((a,b)=>compareResults({...a.result,id:a.id},{...b.result,id:b.id}));
    return { ...p.result, attemptId:p.id, roomId:p.roomId, gameType:room.gameType, mode:room.mode,
      durationSeconds:room.durationSeconds, rulesVersion:room.rulesVersion, finishedAt:p.finishedAt,
      rank:p.result.rank || ranked.findIndex(x=>x.id===p.id)+1 };
  }) };
}

module.exports = { history, start, stop, sweep, create, list, join, detail, ready, begin, switchTeam, sync, leave, active, rematch, leaderboard };

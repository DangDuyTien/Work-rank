'use strict';
const crypto = require('node:crypto');
const { Op } = require('sequelize');
const { ArcadeRoom: Room, ArcadePlayer: Player, User, Season, ScoreLedger } = require('../models');
const transaction = require('./typingTransaction');
const { ValidationError, NotFoundError, ForbiddenError } = require('../utils/errors');
const engine = import('../../../shared/arcade/engine.mjs');
const GRACE_MS = 30000;
const DELIVERY_MS = 10000;
const rulesFor = (room) => ({ durationMs: room.durationSeconds * 1000, difficulty: room.difficulty, rulesVersion: room.rulesVersion || 1 });
let io, sweepTimer;

async function roomLocked(id, t) {
  const room = await Room.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
  if (!room) throw new NotFoundError('Không tìm thấy phòng arcade');
  return room;
}
async function members(room, t) {
  return Player.findAll({ where: { roomId: room.id }, include: [{ model: User, attributes: ['id', 'name', 'avatarUrl'] }], order: [['createdAt', 'ASC'], ['id', 'ASC']], transaction: t });
}
function mine(players, userId) {
  const p = players.find((x) => String(x.userId) === String(userId));
  if (!p) throw new ForbiddenError('Bạn không ở trong phòng này');
  return p;
}
async function pack(room, players, userId) {
  const { replay, compareResults } = await engine;
  const ranked = players.filter((p) => p.result).map((p) => ({ ...p.result, id: p.id })).sort(compareResults);
  return {
    room: room.toJSON(), serverNow: Date.now(),
    players: players.map((p, position) => ({
      id: p.id, userId: p.userId, name: p.User?.name || 'Người chơi', avatarUrl: p.User?.avatarUrl,
      position: position + 1, ready: p.ready, revision: p.revision, connected: Date.now() - new Date(p.heartbeatAt).getTime() < GRACE_MS,
      finishedAt: p.finishedAt, result: p.result, rank: p.result ? ranked.findIndex((r) => r.id === p.id) + 1 : null,
      metrics: p.result || replay(room.gameType, room.seed, p.events, rulesFor(room)),
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
async function settle(room, p, t, { forfeited = false } = {}) {
  if (p.finishedAt) return;
  const { replay } = await engine;
  const metrics = replay(room.gameType, room.seed, p.events, rulesFor(room));
  const eligible = !forfeited && metrics.correct > 0 && metrics.accuracy >= 50;
  const awardedXp = eligible ? Math.min(30, Math.floor(metrics.score / 200)) : 0;
  const earlier = await Player.findAll({ where: { userId: p.userId, finishedAt: { [Op.ne]: null } }, include: [{ model: Room, where: { gameType: room.gameType, mode: room.mode, difficulty: room.difficulty, durationSeconds: room.durationSeconds, rulesVersion: room.rulesVersion || 1 } }], transaction: t });
  const previousBestScore = earlier.reduce((best, x) => x.result?.eligible ? Math.max(best, Number(x.result.score || 0)) : best, 0);
  const finishedAt = new Date();
  p.result = { ...metrics, userId: p.userId, startedAt: room.startedAt ? new Date(room.startedAt).toISOString() : null, finishedAt: finishedAt.toISOString(), validatedAt: finishedAt.toISOString(), createdAt: new Date(p.createdAt).toISOString(), awardedXp, eligible, forfeited, attemptId: room.id, playerAttemptId: p.id, mode: room.mode, gameType: room.gameType,
    previousBestScore, personalBestScore: eligible ? Math.max(previousBestScore, metrics.score) : previousBestScore,
    isPersonalBest: eligible && metrics.score > previousBestScore, improvement: metrics.score - previousBestScore };
  p.finishedAt = finishedAt;
  if (awardedXp) {
    const user = await User.findByPk(p.userId, { transaction: t });
    const season = await Season.findOne({ where: { status: 'ACTIVE' }, order: [['id', 'DESC']], transaction: t });
    await ScoreLedger.create({ idempotencyKey: `arcade:${p.id}`, effectType: 'INDIVIDUAL_XP', pointsDelta: awardedXp, userId: p.userId, teamId: user.teamId, seasonId: season?.id || null, eventId: crypto.randomUUID(), reason: `${room.gameType} — lượt chơi đã xác minh`, metadata: p.result }, { transaction: t });
  }
  await p.save({ transaction: t });
}
async function closeIfFinished(room, players, t) {
  if (!players.every((p) => p.finishedAt)) return;
  room.status = 'FINISHED';
  const { compareResults } = await engine;
  const ranked = [...players].sort((a,b)=>compareResults({...a.result,id:a.id},{...b.result,id:b.id}));
  for (let i=0;i<ranked.length;i++) {
    ranked[i].result = { ...ranked[i].result, rank: i+1 };
    await ranked[i].save({transaction:t});
  }
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
  const { GAME_TYPES, CAPACITY, rulesVersionFor } = await engine;
  const { gameType, mode, difficulty = 'mixed' } = data;
  if (!GAME_TYPES.includes(gameType) || !Object.keys(CAPACITY).includes(mode) || !['mixed', 'easy', 'medium', 'hard', 'vietnamese'].includes(difficulty)) throw new ValidationError('Game, chế độ hoặc độ khó không hợp lệ');
  const result = await transaction(async (t) => {
    await User.findByPk(user.id, { transaction: t, lock: t.LOCK.UPDATE });
    const active = await Player.findAll({ where: { userId: user.id, finishedAt: null }, include: [{ model: Room, where: { status: { [Op.in]: ['WAITING', 'PLAYING'] } } }], transaction: t });
    if (active.length) throw new ValidationError('Hãy hoàn thành hoặc rời phòng hiện tại trước khi tạo lượt mới');
    const durationSeconds = Number(process.env.ARCADE_ROUND_SECONDS || 60);
    if (!Number.isInteger(durationSeconds) || durationSeconds < 5 || durationSeconds > 300) throw new Error('ARCADE_ROUND_SECONDS must be 5..300');
    const room = await Room.create({ id: crypto.randomUUID(), gameType, mode, difficulty, capacity: CAPACITY[mode], hostId: user.id, title: `${user.name} · ${mode}`.slice(0, 100), seed: crypto.randomBytes(16).toString('hex'), durationSeconds, rulesVersion: rulesVersionFor(gameType), status: mode === 'SOLO' ? 'PLAYING' : 'WAITING', startedAt: mode === 'SOLO' ? new Date(Date.now() + 3200) : null }, { transaction: t });
    await Player.create({ id: crypto.randomUUID(), roomId: room.id, userId: user.id, heartbeatAt: new Date(), ready: mode === 'SOLO' }, { transaction: t });
    return pack(room, await members(room, t), user.id);
  });
  await changed(result.room.id);
  return result;
}
async function list(gameType, mode) {
  const { GAME_TYPES } = await engine;
  if (!GAME_TYPES.includes(gameType) || !['DUO', 'TRIO'].includes(mode)) throw new ValidationError('Bộ lọc phòng không hợp lệ');
  await sweep();
  const rooms = await Room.findAll({ where: { gameType, mode, status: 'WAITING' }, include: [{ model: Player, as: 'players', required: true, attributes: ['userId'], include: [{ model: User, attributes: ['name'] }] }], order: [['createdAt', 'DESC']], limit: 50 });
  return rooms.map((r) => ({ id: r.id, gameType: r.gameType, mode: r.mode, title: r.title, capacity: CAPACITY[r.mode], players: r.players.length, host: r.players.find((p) => String(p.userId) === String(r.hostId))?.User?.name, status: r.status }));
}
async function join(id, userId) {
  const result = await transaction(async (t) => {
    await User.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
    const room = await roomLocked(id, t);
    const players = await members(room, t);
    if (players.some((p) => String(p.userId) === String(userId))) return pack(room, players, userId);
    if (room.mode === 'SOLO' || room.status !== 'WAITING' || players.length >= room.capacity) throw new ValidationError('Phòng đã đầy hoặc không thể tham gia');
    const active = await Player.findOne({ where: { userId, finishedAt: null }, include: [{ model: Room, where: { status: { [Op.in]: ['WAITING', 'PLAYING'] } } }], transaction: t });
    if (active) throw new ValidationError('Bạn đang ở một phòng khác');
    await Player.create({ id: crypto.randomUUID(), roomId: id, userId, heartbeatAt: new Date() }, { transaction: t });
    for (const p of players) { p.ready = false; await p.save({ transaction: t }); }
    room.revision++;
    await room.save({ transaction: t });
    return pack(room, await members(room, t), userId);
  });
  await changed(id);
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
  return mutate(id, userId, async (room, players, p, t) => {
    if (room.status !== 'WAITING') throw new ValidationError('Trận đấu đã bắt đầu');
    p.ready = value; p.heartbeatAt = new Date(); await p.save({ transaction: t });
  });
}
async function begin(id, userId) {
  return mutate(id, userId, async (room, players) => {
    if (String(room.hostId) !== String(userId)) throw new ForbiddenError('Chỉ chủ phòng được bắt đầu');
    if (room.status !== 'WAITING' || players.length !== room.capacity || players.some((p) => !p.ready || Date.now() - new Date(p.heartbeatAt).getTime() > GRACE_MS)) throw new ValidationError('Cần đủ người và tất cả sẵn sàng');
    room.status = 'PLAYING'; room.startedAt = new Date(Date.now() + 3200);
  });
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
  return mutate(id, userId, async (room, players, p, t) => {
    if (room.status === 'WAITING') {
      await p.destroy({ transaction: t }); players.splice(players.indexOf(p), 1);
      if (!players.length) room.status = 'CLOSED';
      else {
        if (String(room.hostId) === String(userId)) room.hostId = players[0].userId;
        for (const x of players) { x.ready = false; await x.save({ transaction: t }); }
      }
    } else if (room.status === 'PLAYING') { await settle(room, p, t, { forfeited: true }); await closeIfFinished(room, players, t); }
  }, { allowAbsent: true });
}
async function active(userId) {
  const p = await Player.findOne({ where: { userId, finishedAt: null }, include: [{ model: Room, where: { status: { [Op.in]: ['WAITING', 'PLAYING'] } } }], order: [['createdAt', 'DESC']] });
  return p ? detail(p.roomId, userId) : null;
}
async function rematch(id, user) {
  const { rulesVersionFor } = await engine;
  const result = await transaction(async (t) => {
    await User.findByPk(user.id, { transaction: t, lock: t.LOCK.UPDATE });
    const old = await roomLocked(id, t);
    mine(await members(old, t), user.id);
    if (old.status !== 'FINISHED') throw new ValidationError('Chờ tất cả người chơi hoàn thành để chơi lại');
    let next = old.rematchId ? await Room.findByPk(old.rematchId, { transaction: t, lock: t.LOCK.UPDATE }) : null;
    const active = await Player.findOne({ where: { userId: user.id, finishedAt: null }, include: [{ model: Room, where: { status: { [Op.in]: ['WAITING', 'PLAYING'] } } }], transaction: t });
    if (active && active.roomId !== next?.id) throw new ValidationError('Bạn đang có một lượt chơi khác');
    if (!next || !['WAITING', 'PLAYING'].includes(next.status)) {
      next = await Room.create({ id: crypto.randomUUID(), gameType: old.gameType, mode: old.mode, difficulty: old.difficulty, capacity: old.capacity, durationSeconds: old.durationSeconds,
        rulesVersion: rulesVersionFor(old.gameType), seed: crypto.randomBytes(16).toString('hex'), hostId: user.id, title: `${user.name} · ${old.mode}`.slice(0, 100), status: old.mode === 'SOLO' ? 'PLAYING' : 'WAITING', startedAt: old.mode === 'SOLO' ? new Date(Date.now() + 3200) : null }, { transaction: t });
      old.rematchId = next.id; old.revision++; await old.save({ transaction: t });
    }
    const nextPlayers = await members(next, t);
    if (!nextPlayers.some((p) => String(p.userId) === String(user.id))) {
      if ((next.status !== 'WAITING' && next.mode !== 'SOLO') || nextPlayers.length >= next.capacity) throw new ValidationError('Ván tiếp theo đã đầy hoặc đã bắt đầu');
      await Player.create({ id: crypto.randomUUID(), roomId: next.id, userId: user.id, heartbeatAt: new Date(), ready: next.mode === 'SOLO' }, { transaction: t });
      for (const p of nextPlayers) { p.ready = false; await p.save({ transaction: t }); }
      next.revision++; await next.save({ transaction: t });
    }
    return pack(next, await members(next, t), user.id);
  });
  await changed(id); await changed(result.room.id);
  return result;
}
async function leaderboard(gameType, mode, period, userId, difficulty = 'mixed') {
  const { GAME_TYPES, CAPACITY, compareResults, rulesVersionFor } = await engine;
  if (!GAME_TYPES.includes(gameType) || !Object.keys(CAPACITY).includes(mode) || !['today', 'week', 'month', 'all'].includes(period) || !['mixed', 'easy', 'medium', 'hard', 'vietnamese'].includes(difficulty)) throw new ValidationError('Bộ lọc BXH không hợp lệ');
  const now = new Date();
  // WorkRank arcade periods use the product's Asia/Ho_Chi_Minh calendar.
  const local = new Date(now.getTime() + 7 * 3600000);
  local.setUTCHours(0, 0, 0, 0);
  if (period === 'week') local.setUTCDate(local.getUTCDate() - (local.getUTCDay() + 6) % 7);
  if (period === 'month') local.setUTCDate(1);
  const where = { finishedAt: period === 'all' ? { [Op.ne]: null } : { [Op.gte]: new Date(local.getTime() - 7 * 3600000) } };
  const durationSeconds = Number(process.env.ARCADE_ROUND_SECONDS || 60);
  const rows = await Player.findAll({ where, include: [{ model: Room, where: { gameType, mode, durationSeconds, rulesVersion: rulesVersionFor(gameType), ...(gameType === 'computer_rush' ? { difficulty } : {}) } }, { model: User, attributes: ['name', 'avatarUrl'] }] });
  const best = new Map();
  for (const p of rows) {
    if (!p.result?.eligible) continue;
    const entry = { ...p.result, id: p.id, userId: p.userId, name: p.User?.name, avatarUrl: p.User?.avatarUrl };
    const previous = best.get(String(p.userId));
    if (!previous || compareResults(entry, previous) < 0) best.set(String(p.userId), entry);
  }
  const ranked = [...best.values()].sort(compareResults).map((x, i) => ({ ...x, rank: i + 1 }));
  return { rows: ranked.slice(0, 100), personal: ranked.find((x) => String(x.userId) === String(userId)) || null, gameType, mode, period, durationSeconds, rulesVersion: rulesVersionFor(gameType) };
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

module.exports = { history, start, stop, sweep, create, list, join, detail, ready, begin, sync, leave, active, rematch, leaderboard };

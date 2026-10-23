'use strict';

const crypto = require('node:crypto');
const { Op } = require('sequelize');

const {
  MusicSong,
  TypingPracticeAttempt: Attempt,
  TypingUserStat: Stat,
  TypingMatchResult,
  User,
  Season,
  ScoreLedger,
} = require('../models');

const transaction = require('./typingTransaction');
const scoring = require('./musicScoring');
const { seedMusicSongs } = require('../seeders/musicSongs.seeder');
const { ValidationError, NotFoundError, ForbiddenError } = require('../utils/errors');

/** Extra wall-clock seconds a run may use for stops before the attempt expires. */
const PAUSE_BUDGET_SECONDS = 240;

let seeded = false;

async function ensureCatalog() {
  if (seeded) return;
  try {
    await seedMusicSongs();
    seeded = true;
  } catch (error) {
    console.warn('[MusicRace] catalog seed skipped:', error.message);
  }
}

const publicSong = (row) => (row?.toPublic ? row.toPublic() : row);

async function listSongs({ includeInactive = false } = {}) {
  await ensureCatalog();
  const where = includeInactive ? {} : { isActive: true };
  const rows = await MusicSong.findAll({ where, order: [['difficulty', 'ASC'], ['title', 'ASC']] });
  return rows.map(publicSong);
}

async function getSong(id) {
  if (!id) return null;
  await ensureCatalog();
  const row = await MusicSong.findByPk(String(id));
  if (!row || !row.isActive) return null;
  return publicSong(row);
}

/** Admin ingestion. A song is never published with missing audio, timings or rights. */
async function publishSong(payload, requestingUser) {
  if (!requestingUser) throw new ForbiddenError('Cần đăng nhập để thêm bài hát');
  const errors = scoring.validateSongForPublish(payload);
  if (errors.length) throw new ValidationError(errors.join(' · '));

  const [row] = await MusicSong.upsert({
    id: String(payload.id),
    title: payload.title,
    artist: payload.artist || 'WorkRank Originals',
    language: payload.language || 'VI',
    bpm: Number(payload.bpm) || 0,
    difficulty: payload.difficulty || 'MEDIUM',
    durationMs: Number(payload.durationMs) || 0,
    timedLyricsVersion: Number(payload.timedLyricsVersion) || 1,
    audioSource: payload.audioSource,
    lyricsSource: payload.lyricsSource,
    lines: payload.lines,
    metrics: payload.metrics || null,
    isActive: payload.isActive !== false,
    publishedAt: new Date(),
    createdBy: requestingUser.id,
  });
  return publicSong(row);
}

function expose(attempt, song) {
  return {
    attemptId: attempt.id,
    status: attempt.status,
    songId: attempt.musicSongId,
    song,
    challengeText: attempt.challengeText,
    durationLimitSeconds: attempt.durationSeconds,
    startedAt: attempt.startedAt,
    serverNow: new Date(),
    result: attempt.result,
  };
}

async function createAttempt(userId, { songId } = {}) {
  const song = await getSong(songId);
  if (!song) throw new ValidationError('Bài hát không tồn tại hoặc chưa được phát hành.');
  const text = scoring.lyricText(song);
  const durationSeconds = Math.ceil(Number(song.durationMs) / 1000) + PAUSE_BUDGET_SECONDS;

  return transaction(async (t) => {
    await User.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
    await Attempt.update(
      { status: 'ABANDONED' },
      {
        where: { userId, status: { [Op.in]: ['READY', 'ACTIVE'] }, musicSongId: { [Op.ne]: null } },
        transaction: t,
      }
    );
    const attempt = await Attempt.create(
      {
        id: crypto.randomUUID(),
        userId,
        status: 'ACTIVE',
        durationSeconds,
        challengeText: text,
        typedText: '',
        inputRevision: 0,
        musicSongId: song.id,
        musicEvidence: null,
        // The client starts the audio on the same gesture that asks for the
        // attempt, so the server clock starts here instead of on first progress.
        startedAt: new Date(),
      },
      { transaction: t }
    );
    return expose(attempt, song);
  });
}

async function ownedAttempt(id, userId, t) {
  const attempt = await Attempt.findOne({ where: { id, userId }, transaction: t, ...(t ? { lock: t.LOCK.UPDATE } : {}) });
  if (!attempt) throw new NotFoundError('Không tìm thấy lượt chơi');
  return attempt;
}

async function progress(attemptId, userId, data = {}) {
  return transaction(async (t) => {
    const attempt = await ownedAttempt(attemptId, userId, t);
    if (attempt.status === 'FINISHED' || attempt.status === 'ABANDONED') return expose(attempt);
    const revision = Number(data.inputRevision);
    if (typeof data.typedText === 'string' && Number.isSafeInteger(revision) && revision > attempt.inputRevision) {
      if (data.typedText.length > attempt.challengeText.length) throw new ValidationError('Nội dung gõ vượt quá lời bài hát');
      attempt.typedText = data.typedText.normalize('NFC');
      attempt.inputRevision = revision;
    }
    if (data.music && typeof data.music === 'object') {
      // Store the client's view for disconnect recovery; the score is still
      // recomputed from typed text + elapsed time at finish.
      attempt.musicEvidence = {
        pauseCount: Math.max(0, Number(data.music.pauseCount) || 0),
        bestNoPauseStreak: Math.max(0, Number(data.music.bestNoPauseStreak) || 0),
        lineIndex: Math.max(0, Number(data.music.lineIndex) || 0),
      };
    }
    await attempt.save({ transaction: t });
    return expose(attempt);
  });
}

async function finish(userId, data = {}) {
  if (!data?.attemptId) throw new ValidationError('Thiếu attemptId do máy chủ cấp.');
  const attempt = await ownedAttempt(data.attemptId, userId);
  if (attempt.status === 'FINISHED') return attempt.result;
  if (attempt.status === 'ABANDONED') throw new ValidationError('Lượt chơi này đã được thay thế.');

  const song = await getSong(attempt.musicSongId);
  if (!song) throw new ValidationError('Bài hát của lượt chơi không còn được phát hành.');

  const elapsedRaw = attempt.startedAt ? Date.now() - new Date(attempt.startedAt).getTime() : 0;
  const elapsedMs = Math.min(Math.max(0, elapsedRaw), attempt.durationSeconds * 1000);
  const typedText = typeof data.typedText === 'string' ? data.typedText.normalize('NFC') : attempt.typedText;

  // Solo runs send the evidence at the top level (it is the whole payload);
  // room runs nest it under `music`. Accept both, never trust either blindly.
  const rawEvidence = data.music && typeof data.music === 'object' ? data.music : data;
  const evaluation = scoring.evaluateMusicEvidence({
    song,
    typedText,
    elapsedMs,
    evidence: {
      pauseCount: rawEvidence?.pauseCount ?? attempt.musicEvidence?.pauseCount ?? 0,
      bestNoPauseStreak: rawEvidence?.bestNoPauseStreak ?? attempt.musicEvidence?.bestNoPauseStreak ?? 0,
    },
  });

  const finishedAt = new Date();
  const totalLines = evaluation.totalLines;
  const recorded = evaluation.valid
    && evaluation.linesCompleted >= Math.ceil(totalLines * 0.6)
    && elapsedMs >= Number(song.durationMs) * 0.5;

  const awardedXp = recorded
    ? Math.min(120, Math.max(5, Math.round(evaluation.score / 120)))
    : 0;

  const result = {
    ...evaluation,
    attemptId: attempt.id,
    userId,
    gameType: 'typing_battle',
    mode: 'SOLO',
    songId: song.id,
    songTitle: song.title,
    music: true,
    rank: 1,
    performanceScore: evaluation.score,
    completed: evaluation.completed,
    metricVersion: 3,
    validSubmission: evaluation.valid,
    eligible: recorded,
    recorded,
    awardedXp,
    startedAt: attempt.startedAt ? new Date(attempt.startedAt).toISOString() : null,
    finishedAt: finishedAt.toISOString(),
    validatedAt: finishedAt.toISOString(),
    createdAt: new Date(attempt.createdAt).toISOString(),
    reason: recorded ? null : 'INVALID_PARTICIPATION',
    message: recorded
      ? 'Máy chủ đã đối chiếu lời bài hát, số câu hoàn thành và số lần nhạc phải dừng.'
      : 'Lượt này chưa đủ điều kiện ghi bảng xếp hạng.',
  };

  await transaction(async (t) => {
    const fresh = await Attempt.findByPk(attempt.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!fresh || fresh.status === 'FINISHED') return;

    if (recorded) {
      const [stat] = await Stat.findOrCreate({ where: { userId }, defaults: { userId }, transaction: t });
      await stat.reload({ transaction: t, lock: t.LOCK.UPDATE });
      stat.musicBestFlowPct = Math.max(Number(stat.musicBestFlowPct || 0), evaluation.flowPct);
      stat.musicBestScore = Math.max(Number(stat.musicBestScore || 0), evaluation.score);
      stat.musicBestStreak = Math.max(Number(stat.musicBestStreak || 0), evaluation.bestNoPauseStreak);
      stat.musicNoPauseRuns = Number(stat.musicNoPauseRuns || 0) + (evaluation.pauseCount === 0 ? 1 : 0);
      stat.totalMatches = Number(stat.totalMatches || 0) + 1;
      stat.practiceMatches = Number(stat.practiceMatches || 0) + 1;
      stat.bestAccuracy = Math.max(Number(stat.bestAccuracy || 0), evaluation.accuracy);
      stat.totalCharsTyped = Number(stat.totalCharsTyped || 0) + evaluation.typedChars;
      stat.totalErrors = Number(stat.totalErrors || 0) + evaluation.errorCount;
      stat.totalWorkRankPointsEarned = Number(stat.totalWorkRankPointsEarned || 0) + awardedXp;
      stat.lastPlayedAt = finishedAt;
      await stat.save({ transaction: t });

      const user = await User.findByPk(userId, { transaction: t });
      const season = await Season.findOne({ where: { status: 'ACTIVE' }, order: [['id', 'DESC']], transaction: t });
      await ScoreLedger.create(
        {
          idempotencyKey: `typing_music_attempt:${attempt.id}`,
          effectType: 'INDIVIDUAL_XP',
          pointsDelta: awardedXp,
          userId,
          teamId: user?.teamId || null,
          seasonId: season?.id || null,
          eventId: crypto.randomUUID(),
          reason: `Đua Gõ Theo Nhạc — ${song.title} · liền mạch ${evaluation.flowPct}%`,
          metadata: { songId: song.id, score: evaluation.score, flowPct: evaluation.flowPct, pauseCount: evaluation.pauseCount },
        },
        { transaction: t }
      );
    }

    fresh.status = 'FINISHED';
    fresh.finishedAt = finishedAt;
    fresh.result = result;
    fresh.musicEvidence = {
      pauseCount: evaluation.pauseCount,
      bestNoPauseStreak: evaluation.bestNoPauseStreak,
      linesCompleted: evaluation.linesCompleted,
    };
    await fresh.save({ transaction: t });
  });

  return result;
}

const scoreOf = (result) => Number(result?.score ?? result?.musicScore ?? 0) || 0;

/**
 * Every ranked music run, from solo attempts and from multiplayer rooms.
 * Both paths store the same fields, so the board can compare them directly.
 */
async function collectRecords({ userId = null, limit = 400 } = {}) {
  const attemptWhere = { status: 'FINISHED', musicSongId: { [Op.ne]: null } };
  if (userId) attemptWhere.userId = userId;
  const [attempts, matches] = await Promise.all([
    Attempt.findAll({
      where: attemptWhere,
      attributes: ['userId', 'musicSongId', 'result', 'finishedAt'],
      order: [['finishedAt', 'DESC']],
      limit,
    }),
    TypingMatchResult.findAll({
      where: { musicSongId: { [Op.ne]: null } },
      attributes: ['results', 'musicSongId', 'playedAt'],
      order: [['playedAt', 'DESC']],
      limit: Math.max(20, Math.ceil(limit / 4)),
    }),
  ]);

  const rows = [];
  for (const attempt of attempts) {
    const result = attempt.result;
    if (!result || !result.recorded) continue;
    rows.push({ userId: Number(attempt.userId), songId: attempt.musicSongId, result, at: attempt.finishedAt });
  }
  for (const match of matches) {
    for (const result of Array.isArray(match.results) ? match.results : []) {
      if (!result?.music || !result.eligible) continue;
      rows.push({ userId: Number(result.userId), songId: match.musicSongId, result, at: match.playedAt });
    }
  }
  return rows.sort((a, b) => new Date(b.at) - new Date(a.at));
}

async function getMyStats(userId) {
  if (!userId) return null;
  const [stat] = await Stat.findOrCreate({ where: { userId }, defaults: { userId } });
  const records = await collectRecords({ userId, limit: 200 });
  const bestBySong = {};
  let bestRun = null;
  for (const row of records) {
    const score = scoreOf(row.result);
    if (score > (bestBySong[row.songId] || 0)) bestBySong[row.songId] = score;
    if (!bestRun || score > scoreOf(bestRun)) bestRun = row.result;
  }
  return {
    runs: records.length,
    bestScore: Math.max(Number(stat.musicBestScore || 0), bestRun ? scoreOf(bestRun) : 0),
    bestFlowPct: Number(stat.musicBestFlowPct || 0),
    bestNoPauseStreak: Number(stat.musicBestStreak || 0),
    noPauseRuns: Number(stat.musicNoPauseRuns || 0),
    lastRun: records[0]?.result || null,
    bestBySong,
  };
}

async function getLeaderboard({ limit = 50 } = {}) {
  const records = await collectRecords({ limit: 500 });
  const bestByUser = new Map();
  for (const row of records) {
    const current = bestByUser.get(row.userId);
    const score = scoreOf(row.result);
    if (!current || score > scoreOf(current)) {
      bestByUser.set(row.userId, { ...row.result, userId: row.userId, songId: row.songId, score });
    }
  }
  const rows = [...bestByUser.values()].sort((a, b) => (
    scoreOf(b) - scoreOf(a)
    || Number(b.flowPct || 0) - Number(a.flowPct || 0)
    || Number(b.accuracy || 0) - Number(a.accuracy || 0)
  ));
  const ids = rows.map((row) => row.userId);
  const users = ids.length
    ? await User.findAll({ where: { id: ids }, attributes: ['id', 'name', 'jobTitle', 'department'] })
    : [];
  return {
    leaderboard: rows.slice(0, Math.min(100, Math.max(1, Number(limit) || 50))).map((row, index) => ({
      ...row,
      rank: index + 1,
      user: users.find((user) => Number(user.id) === row.userId) || null,
    })),
  };
}

module.exports = {
  PAUSE_BUDGET_SECONDS,
  ensureCatalog,
  listSongs,
  getSong,
  publishSong,
  createAttempt,
  progress,
  finish,
  getMyStats,
  getLeaderboard,
};

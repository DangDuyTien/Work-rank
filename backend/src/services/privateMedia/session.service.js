'use strict';

/**
 * PRIVATE MEDIA — MEDIA SESSION SERVICE
 *
 * One logical session (V1). All three control surfaces (web UI, Telegram,
 * Mac helper hotkey) funnel through `issueCommand`, so there is exactly one
 * place where a command is authorized, deduped, applied and broadcast.
 *
 * Consistency model:
 *   command issued  -> logical state updated optimistically
 *   player ack      -> logical state reconciled with what the browser really did
 *   state broadcast -> every controller (web/telegram/hotkey) sees the same thing
 *
 * The browser is a renderer, not the source of truth: autoplay refusals and
 * player errors are reported back through `acknowledgeCommand` and immediately
 * pushed to every controller.
 */

const { Op } = require('sequelize');
const env = require('../../config/env');
const { PrivateMediaSession, PrivateMediaCommand } = require('../../models');
const audit = require('./audit.service');

const DEFAULT_SESSION_KEY = env.privateMedia?.sessionKey || 'primary';

/**
 * One playback session PER ACCOUNT.
 *
 * The owner keeps the historical `primary` key (so existing state is not lost);
 * every granted account gets `user:<id>`. That is what makes listening private:
 * two people with access no longer share one playhead, one queue and one volume
 * — each browser plays its own audio, and a delegated user changing the volume
 * cannot make the owner's speakers louder.
 *
 * Devices (Mac helper) and Telegram commands carry the owner's user id, so they
 * still drive the owner's session.
 */
async function sessionKeyFor(userId) {
  if (!userId) return DEFAULT_SESSION_KEY;
  try {
    // Lazy require: access.service is loaded by the middleware and importing it
    // at module scope would create a cycle.
    const accessService = require('./access.service');
    if (await accessService.isOwner(userId)) return DEFAULT_SESSION_KEY;
  } catch {
    // Fail closed to the caller's own session, never to somebody else's.
  }
  return `user:${Number(userId)}`;
}

const ACTIONS = Object.freeze({
  LOAD_VIDEO: 'LOAD_VIDEO',
  PLAY: 'PLAY',
  PAUSE: 'PAUSE',
  TOGGLE_PLAY_PAUSE: 'TOGGLE_PLAY_PAUSE',
  STOP: 'STOP',
  NEXT: 'NEXT',
  PREVIOUS: 'PREVIOUS',
  SEEK: 'SEEK',
  SET_VOLUME: 'SET_VOLUME',
});

const ACTION_LIST = Object.values(ACTIONS);

// Actions that only make sense once a video is loaded.
const REQUIRES_VIDEO = new Set([
  ACTIONS.PLAY,
  ACTIONS.PAUSE,
  ACTIONS.TOGGLE_PLAY_PAUSE,
  ACTIONS.STOP,
  ACTIONS.SEEK,
  ACTIONS.NEXT,
  ACTIONS.PREVIOUS,
]);

// Actions that change what is on screen (audited by name).
const AUDIT_ACTION_BY_COMMAND = {
  [ACTIONS.LOAD_VIDEO]: 'VIDEO_SELECTED',
  [ACTIONS.PLAY]: 'PLAY',
  [ACTIONS.PAUSE]: 'PAUSE',
  [ACTIONS.TOGGLE_PLAY_PAUSE]: 'TOGGLE_PLAY_PAUSE',
  [ACTIONS.STOP]: 'STOP',
  [ACTIONS.NEXT]: 'NEXT',
  [ACTIONS.PREVIOUS]: 'PREVIOUS',
  [ACTIONS.SEEK]: 'SEEK',
  [ACTIONS.SET_VOLUME]: 'SET_VOLUME',
};

class PrivateMediaCommandError extends Error {
  constructor(code, message, status = 400) {
    super(message || code);
    this.name = 'PrivateMediaCommandError';
    this.code = code;
    this.status = status;
  }
}

function clampNumber(value, min, max, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(Math.max(numeric, min), max);
}

function normalizeVideoId(value) {
  const raw = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{11}$/.test(raw)) return null;
  return raw;
}

function publicVideo(entry) {
  if (!entry) return null;
  return {
    videoId: entry.videoId || entry.video_id || null,
    title: entry.title || null,
    channelTitle: entry.channelTitle || entry.channel_title || null,
    thumbnailUrl: entry.thumbnailUrl || entry.thumbnail_url || null,
    durationSeconds: entry.durationSeconds ?? entry.duration_seconds ?? null,
  };
}

/** Serializable session shape shared by HTTP and socket payloads. */
function serializeSession(session) {
  if (!session) return null;
  return {
    sessionId: session.id,
    sessionKey: session.sessionKey || DEFAULT_SESSION_KEY,
    status: session.status,
    video: session.currentVideoId
      ? {
        videoId: session.currentVideoId,
        title: session.title,
        channelTitle: session.channelTitle,
        thumbnailUrl: session.thumbnailUrl,
        durationSeconds: session.durationSeconds,
      }
      : null,
    currentTime: Number(session.currentTime || 0),
    volume: Number(session.volume ?? 100),
    queue: Array.isArray(session.queue) ? session.queue.map(publicVideo).filter(Boolean) : [],
    queueIndex: Number(session.queueIndex ?? -1),
    playerOnline: Boolean(session.playerOnline),
    controllerUserId: session.controllerUserId || null,
    updatedAt: session.updatedAt,
  };
}

async function getSession(userId) {
  const sessionKey = await sessionKeyFor(userId);
  const [session] = await PrivateMediaSession.findOrCreate({
    where: { sessionKey },
    defaults: { sessionKey },
  });
  return session;
}

/** Resolve the session a command belongs to (used by acks, which carry an id). */
async function getSessionById(sessionId) {
  if (!sessionId) return getSession();
  const session = await PrivateMediaSession.findByPk(sessionId);
  return session || getSession();
}

async function getSessionState(userId) {
  const session = await getSession(userId);
  return serializeSession(session);
}

function nextQueueEntry(session, direction) {
  const queue = Array.isArray(session.queue) ? session.queue : [];
  if (!queue.length) return null;
  const index = Number(session.queueIndex ?? -1);
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= queue.length) return null;
  return { entry: queue[targetIndex], index: targetIndex };
}

/**
 * Apply the logical transition for one command.
 * Returns the fields to persist on the session.
 */
function planTransition(session, action, payload = {}) {
  const currentVideoId = session.currentVideoId;

  switch (action) {
    case ACTIONS.LOAD_VIDEO: {
      const videoId = normalizeVideoId(payload.videoId);
      if (!videoId) throw new PrivateMediaCommandError('INVALID_VIDEO_ID', 'Video không hợp lệ');
      const queue = Array.isArray(payload.queue) && payload.queue.length
        ? payload.queue.map(publicVideo).filter((item) => item?.videoId).slice(0, 50)
        : (Array.isArray(session.queue) ? session.queue : []);
      const queueIndex = queue.findIndex((item) => item.videoId === videoId);
      return {
        status: 'LOADING',
        currentVideoId: videoId,
        title: payload.title ? String(payload.title).slice(0, 255) : null,
        channelTitle: payload.channelTitle ? String(payload.channelTitle).slice(0, 191) : null,
        thumbnailUrl: payload.thumbnailUrl ? String(payload.thumbnailUrl).slice(0, 512) : null,
        durationSeconds: Number.isFinite(Number(payload.durationSeconds)) ? Math.max(0, Math.round(Number(payload.durationSeconds))) : null,
        currentTime: 0,
        volume: Number.isFinite(Number(payload.volume)) ? clampNumber(payload.volume, 0, 100, session.volume) : Number(session.volume ?? 100),
        queue,
        queueIndex,
        controllerUserId: payload.actorUserId || session.controllerUserId,
      };
    }

    case ACTIONS.PLAY:
      return { status: 'PLAYING' };

    case ACTIONS.PAUSE:
      return { status: 'PAUSED' };

    case ACTIONS.TOGGLE_PLAY_PAUSE:
      return { status: session.status === 'PLAYING' ? 'PAUSED' : 'PLAYING' };

    case ACTIONS.STOP:
      return { status: 'STOPPED', currentTime: 0 };

    case ACTIONS.SEEK:
      return { currentTime: clampNumber(payload.position, 0, Number(session.durationSeconds) || 24 * 3600, Number(session.currentTime || 0)) };

    case ACTIONS.SET_VOLUME:
      return { volume: clampNumber(payload.volume, 0, 100, Number(session.volume ?? 100)) };

    case ACTIONS.NEXT:
    case ACTIONS.PREVIOUS: {
      const next = nextQueueEntry(session, action === ACTIONS.NEXT ? 1 : -1);
      if (!next) {
        throw new PrivateMediaCommandError(
          action === ACTIONS.NEXT ? 'NO_NEXT_TRACK' : 'NO_PREVIOUS_TRACK',
          action === ACTIONS.NEXT ? 'Không còn video tiếp theo' : 'Không có video trước đó',
        );
      }
      return {
        status: 'LOADING',
        currentVideoId: next.entry.videoId,
        title: next.entry.title || null,
        channelTitle: next.entry.channelTitle || null,
        thumbnailUrl: next.entry.thumbnailUrl || null,
        durationSeconds: next.entry.durationSeconds ?? null,
        currentTime: 0,
        queueIndex: next.index,
      };
    }

    default:
      throw new PrivateMediaCommandError('UNKNOWN_ACTION', 'Lệnh không hợp lệ');
  }
}

function serializeCommand(command) {
  if (!command) return null;
  return {
    commandId: command.commandId,
    action: command.action,
    source: command.source,
    status: command.status,
    errorCode: command.errorCode || null,
    issuedByUserId: command.issuedByUserId || null,
    payload: command.payload || null,
    createdAt: command.createdAt,
    executedAt: command.executedAt,
  };
}

/**
 * Issue a control command.
 *
 * @param {object} input
 * @param {string} input.commandId     client-generated UUID; dedupe key
 * @param {string} input.action        one of ACTIONS
 * @param {'WEB'|'TELEGRAM'|'HOTKEY'|'SYSTEM'} input.source
 * @param {number} input.actorUserId
 * @param {object} [input.payload]
 * @returns {Promise<{command: object, state: object, duplicate: boolean}>}
 */
async function issueCommand({ commandId, action, source = 'WEB', actorUserId, payload = {} }) {
  const normalizedAction = String(action || '').toUpperCase();
  if (!ACTION_LIST.includes(normalizedAction)) {
    throw new PrivateMediaCommandError('UNKNOWN_ACTION', 'Lệnh không hợp lệ');
  }

  const dedupeKey = String(commandId || '').trim().slice(0, 64);
  if (!dedupeKey) throw new PrivateMediaCommandError('MISSING_COMMAND_ID', 'Thiếu mã lệnh');

  // Idempotency first: a duplicate must not mutate state a second time.
  const existing = await PrivateMediaCommand.findOne({ where: { commandId: dedupeKey } });
  if (existing) {
    return {
      command: serializeCommand(existing),
      state: serializeSession(await getSessionById(existing.sessionId)),
      duplicate: true,
    };
  }

  const session = await getSession(actorUserId);

  if (REQUIRES_VIDEO.has(normalizedAction) && !session.currentVideoId) {
    throw new PrivateMediaCommandError('NO_ACTIVE_MEDIA_SESSION', 'Chưa có video nào đang phát', 409);
  }

  const changes = planTransition(session, normalizedAction, { ...payload, actorUserId });

  let command;
  try {
    command = await PrivateMediaCommand.create({
      commandId: dedupeKey,
      sessionId: session.id,
      action: normalizedAction,
      source: ['WEB', 'TELEGRAM', 'HOTKEY', 'SYSTEM'].includes(source) ? source : 'SYSTEM',
      issuedByUserId: actorUserId || null,
      payload: payload && Object.keys(payload).length ? payload : null,
      status: 'QUEUED',
    });
  } catch (error) {
    if (error?.name === 'SequelizeUniqueConstraintError') {
      // Lost a race with an identical command — treat it as a duplicate.
      const raced = await PrivateMediaCommand.findOne({ where: { commandId: dedupeKey } });
      return {
        command: serializeCommand(raced),
        state: serializeSession(await getSessionById(raced?.sessionId)),
        duplicate: true,
      };
    }
    throw error;
  }

  await session.update(changes);

  const auditAction = AUDIT_ACTION_BY_COMMAND[normalizedAction];
  if (auditAction) {
    await audit.record({
      action: auditAction,
      actorUserId: actorUserId || null,
      source: command.source,
      metadata: {
        commandId: dedupeKey,
        videoId: session.currentVideoId,
        title: session.title,
        position: normalizedAction === ACTIONS.SEEK ? changes.currentTime : undefined,
        volume: normalizedAction === ACTIONS.SET_VOLUME ? changes.volume : undefined,
      },
    });
  }

  return { command: serializeCommand(command), state: serializeSession(session), duplicate: false };
}

/**
 * Browser player acknowledgement. The player wins on facts it can observe
 * (real playback status, current time, duration); the backend keeps the intent.
 */
async function acknowledgeCommand({ commandId, actorUserId, state = {}, errorCode = null }) {
  const key = String(commandId || '').trim().slice(0, 64);
  if (!key) return { applied: false, state: await getSessionState() };

  const command = await PrivateMediaCommand.findOne({ where: { commandId: key } });
  if (!command) return { applied: false, state: await getSessionState(actorUserId) };

  const session = await getSessionById(command.sessionId);
  const changes = {};

  if (errorCode) {
    command.status = 'FAILED';
    command.errorCode = String(errorCode).slice(0, 64);
    if (String(errorCode).startsWith('AUTOPLAY')) {
      changes.status = 'PAUSED';
    }
  } else {
    command.status = 'EXECUTED';
    const reportedStatus = String(state.status || '').toUpperCase();
    if (['PLAYING', 'PAUSED', 'STOPPED', 'LOADING', 'IDLE', 'ERROR'].includes(reportedStatus)) {
      changes.status = reportedStatus;
    }
    // A SEEK ack is sent as soon as the command arrives, i.e. usually BEFORE the
    // player has moved: echoing `currentTime` there would write the old position
    // back and undo the jump (the playhead visibly snapped back). The command
    // itself is the authority for position, so the ack only confirms execution.
    const isSeek = command.action === ACTIONS.SEEK;
    if (!isSeek && Number.isFinite(Number(state.currentTime))) {
      changes.currentTime = clampNumber(state.currentTime, 0, 24 * 3600, 0);
    }
    if (Number.isFinite(Number(state.durationSeconds))) {
      changes.durationSeconds = Math.max(0, Math.round(Number(state.durationSeconds)));
    }
    if (Number.isFinite(Number(state.volume))) {
      changes.volume = clampNumber(state.volume, 0, 100, 100);
    }
  }

  command.executedAt = new Date();
  await command.save();
  if (Object.keys(changes).length) await session.update(changes);

  return {
    applied: true,
    command: serializeCommand(command),
    state: serializeSession(session),
  };
}

async function setPlayerPresence(online, userId) {
  const session = await getSession(userId);
  await session.update({
    playerOnline: Boolean(online),
    playerLastSeenAt: new Date(),
  });
  return serializeSession(session);
}

/** Status a command may legitimately set; used for the post-command quiet window. */
const STATUS_ACTIONS = [
  ACTIONS.LOAD_VIDEO, ACTIONS.PLAY, ACTIONS.PAUSE, ACTIONS.TOGGLE_PLAY_PAUSE,
  ACTIONS.STOP, ACTIONS.NEXT, ACTIONS.PREVIOUS,
];

/**
 * A player tick that was already in flight when a command was issued would
 * otherwise land afterwards and undo it (pause, then a stale "still playing"
 * report resumes playback). The command journal is the authority here, so the
 * backend ignores reported status for a short window after any status command.
 *
 * The same race applies to the playhead after a SEEK: the tick that was already
 * in flight still carries the OLD position, so writing it back would drag the
 * session to where the video was before the jump — and the player, which treats
 * the session as authoritative, would then seek backwards. Both fields are
 * therefore gated, each by its own command type.
 */
const POST_COMMAND_QUIET_MS = 3000;

const TIME_ACTIONS = [ACTIONS.SEEK];

/** True when one of `actions` was issued within the quiet window. */
async function hasRecentCommand(actions) {
  const row = await PrivateMediaCommand.findOne({
    where: { action: { [Op.in]: actions } },
    order: [['createdAt', 'DESC']],
    attributes: ['createdAt'],
  });
  if (!row) return false;
  return Date.now() - new Date(row.createdAt).getTime() < POST_COMMAND_QUIET_MS;
}

/** Heartbeat from the browser player: keeps currentTime warm without a command. */
async function syncPlayerProgress({ currentTime, durationSeconds, status }, userId) {
  const session = await getSession(userId);
  // Identity of the newest SEEK this tick could have seen. Compared after the
  // write: anything newer was issued while this tick was in flight.
  const seekBefore = await PrivateMediaCommand.findOne({
    where: { action: ACTIONS.SEEK },
    order: [['id', 'DESC']],
    attributes: ['id'],
  });
  const changes = { playerLastSeenAt: new Date(), playerOnline: true };
  if (Number.isFinite(Number(currentTime))) changes.currentTime = clampNumber(currentTime, 0, 24 * 3600, 0);
  if (Number.isFinite(Number(durationSeconds))) changes.durationSeconds = Math.max(0, Math.round(Number(durationSeconds)));

  const [statusQuiet, timeQuiet] = await Promise.all([
    hasRecentCommand(STATUS_ACTIONS),
    hasRecentCommand(TIME_ACTIONS),
  ]);

  // A tick that was in flight during a SEEK still reports the pre-seek position.
  if (timeQuiet) delete changes.currentTime;

  const normalizedStatus = status ? String(status).toUpperCase() : null;
  if (normalizedStatus && ['PLAYING', 'PAUSED', 'STOPPED', 'LOADING', 'IDLE', 'ERROR'].includes(normalizedStatus)) {
    // Progress still updates time; only the status is gated.
    if (!statusQuiet) {
      changes.status = normalizedStatus;
    }
  }

  await session.update(changes);

  // Repair pass. The check above is not atomic with the write: a SEEK can be
  // issued between them, and this tick would then overwrite the jump with the
  // old position (the player would visibly rewind). The journal is cheap to
  // re-read, and the seek target always wins over a heartbeat.
  if (changes.currentTime !== undefined) {
    const seekAfter = await PrivateMediaCommand.findOne({
      where: { action: ACTIONS.SEEK },
      order: [['id', 'DESC']],
    });
    if (seekAfter && seekAfter.id !== seekBefore?.id) {
      const raw = seekAfter.payload;
      let payload = raw;
      if (typeof raw === 'string') {
        try { payload = JSON.parse(raw); } catch { payload = null; }
      }
      const target = Number(payload?.position);
      if (Number.isFinite(target)) {
        const max = Number(session.durationSeconds) || 24 * 3600;
        await session.update({ currentTime: clampNumber(target, 0, max, target) });
      }
    }
  }

  return serializeSession(session);
}

/** Recent commands (owner/ops visibility; no secrets involved). */
async function recentCommands({ limit = 20, userId } = {}) {
  const session = await getSession(userId);
  const rows = await PrivateMediaCommand.findAll({
    where: { sessionId: session.id },
    order: [['createdAt', 'DESC']],
    limit: Math.min(Number(limit) || 20, 100),
  });
  return rows.map(serializeCommand);
}

/**
 * Recently played videos, newest first, deduped by videoId.
 *
 * Derived from the command journal, so it needs no extra table and works with
 * zero credentials — it is the keyless way to replay something you already
 * loaded without searching again.
 */
async function recentVideos({ limit = 12, userId } = {}) {
  const session = await getSession(userId);
  const rows = await PrivateMediaCommand.findAll({
    where: { action: ACTIONS.LOAD_VIDEO, sessionId: session.id },
    order: [['createdAt', 'DESC']],
    limit: 120,
    attributes: ['payload', 'createdAt', 'source'],
  });

  const seen = new Set();
  const videos = [];

  for (const row of rows) {
    const payload = row.payload || {};
    const videoId = normalizeVideoId(payload.videoId);
    if (!videoId || seen.has(videoId)) continue;
    seen.add(videoId);
    videos.push({
      videoId,
      title: payload.title || null,
      channelTitle: payload.channelTitle || null,
      thumbnailUrl: payload.thumbnailUrl || null,
      durationSeconds: Number.isFinite(Number(payload.durationSeconds)) ? Number(payload.durationSeconds) : null,
      lastPlayedAt: row.createdAt,
      lastSource: row.source,
    });
    if (videos.length >= Math.min(Number(limit) || 12, 50)) break;
  }

  return videos;
}

module.exports = {
  ACTIONS,
  ACTION_LIST,
  PrivateMediaCommandError,
  getSession,
  getSessionById,
  getSessionState,
  sessionKeyFor,
  DEFAULT_SESSION_KEY,
  serializeSession,
  issueCommand,
  acknowledgeCommand,
  setPlayerPresence,
  syncPlayerProgress,
  recentCommands,
  recentVideos,
  normalizeVideoId,
};

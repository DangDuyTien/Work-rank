'use strict';

/**
 * PRIVATE MEDIA — TELEGRAM REMOTE CONTROL
 *
 * Long-polling bot (no inbound webhook surface to expose). Two hard rules:
 *
 *  1. A Telegram account is NEVER sufficient on its own. Every update walks
 *     telegram user id -> binding row -> Work Rank user id -> entitlement.
 *     Unbound chats get a binding instruction, nothing else.
 *  2. The bot token never leaves this module. It is not logged, not returned by
 *     any endpoint, and not written to the audit trail.
 *
 * The bot starts only when TELEGRAM_BOT_TOKEN is present. Without it the rest of
 * the capability still works (web + hotkey); `getStatus()` reports the gap.
 */

const env = require('../../config/env');
const { PrivateMediaTelegramBinding } = require('../../models');
const accessService = require('./access.service');
const pairing = require('./pairing.service');
const sessionService = require('./session.service');
const realtime = require('./realtime.service');
const youtube = require('./youtube.service');
const audit = require('./audit.service');

const API_BASE = 'https://api.telegram.org';
const POLL_TIMEOUT_SECONDS = 25;
const ERROR_BACKOFF_MS = 5000;

let running = false;
let polling = false;
let offset = 0;
let botInfo = null;
let lastError = null;
let loopPromise = null;

function token() {
  return String(env.privateMedia?.telegramBotToken || '').trim();
}

function isEnabled() {
  return token().length > 0;
}

async function callApi(method, payload = {}) {
  if (!isEnabled()) throw new Error('TELEGRAM_DISABLED');
  const response = await fetch(`${API_BASE}/bot${token()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout((POLL_TIMEOUT_SECONDS + 10) * 1000),
  });
  const data = await response.json().catch(() => ({}));
  if (!data.ok) {
    const description = data.description || `HTTP ${response.status}`;
    const error = new Error(description);
    error.telegramCode = data.error_code;
    throw error;
  }
  return data.result;
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const STATUS_LABEL = {
  IDLE: 'Chưa có video',
  LOADING: 'Đang tải video',
  PLAYING: 'Đang phát',
  PAUSED: 'Tạm dừng',
  STOPPED: 'Đã dừng',
  ERROR: 'Lỗi trình phát',
};

function describeState(state) {
  if (!state || !state.video) {
    return '🎬 Chưa có video nào được chọn.\nDùng /search <từ khoá> hoặc dán link trong Work Rank.';
  }
  const lines = [
    `🎬 ${state.video.title || state.video.videoId}`,
    state.video.channelTitle ? `Kênh: ${state.video.channelTitle}` : null,
    `Trạng thái: ${STATUS_LABEL[state.status] || state.status}`,
    state.video.durationSeconds
      ? `Thời lượng: ${formatDuration(state.currentTime)} / ${formatDuration(state.video.durationSeconds)}`
      : `Đang ở: ${formatDuration(state.currentTime)}`,
    state.playerOnline ? 'Trình phát: Đã kết nối' : 'Trình phát đang offline',
  ].filter(Boolean);
  return lines.join('\n');
}

function describeQueue(state) {
  return `Đang phát:\n${state?.video?.title || 'Chưa có bài'}\n\nĐang chờ:\n${state?.queue?.map((q, i) => `${i + 1}. ${q.title || q.videoId}`).join('\n') || 'Hàng chờ đang trống'}`;
}

function controlKeyboard() {
  return {
    inline_keyboard: [[
      { text: '▶ Phát', callback_data: 'pm:play' },
      { text: '⏸ Tạm dừng', callback_data: 'pm:pause' },
      { text: '⏹ Dừng', callback_data: 'pm:stop' },
    ], [
      { text: '🔁 Đảo trạng thái', callback_data: 'pm:toggle' },
      { text: '⏭ Tiếp theo', callback_data: 'pm:next' },
    ]],
  };
}

async function sendMessage(chatId, text, keyboard = null) {
  // With no bot token there is no chat to answer. Binding/authorization logic
  // must still be exercisable (and testable) without a live credential.
  if (!isEnabled()) return null;
  return callApi('sendMessage', {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: keyboard } : {}),
  });
}

/**
 * Resolve a Telegram identity to an authorized Work Rank actor.
 * Returns a denial reason instead of throwing so callers can answer politely.
 */
async function resolveActor(telegramUserId) {
  const binding = await PrivateMediaTelegramBinding.findOne({
    where: { telegramUserId: String(telegramUserId), revokedAt: null },
  });
  if (!binding) return { ok: false, reason: 'NOT_BOUND' };

  const entitlement = await accessService.getEntitlement(binding.userId);
  if (!accessService.hasPermission(entitlement, 'telegram')) {
    return { ok: false, reason: 'NO_ACCESS', userId: binding.userId };
  }

  return { ok: true, userId: Number(binding.userId), entitlement, chatId: binding.telegramChatId };
}

async function bindChat({ code, telegramUser, chatId }) {
  const consumed = await pairing.consumeCode({ code, purpose: pairing.PURPOSES.TELEGRAM });
  if (!consumed) return { ok: false, reason: 'INVALID_CODE' };

  const entitlement = await accessService.getEntitlement(consumed.userId);
  if (!entitlement || !entitlement.canTelegram) {
    return { ok: false, reason: 'NO_ACCESS' };
  }

  const telegramUserId = String(telegramUser.id);
  const existing = await PrivateMediaTelegramBinding.findOne({ where: { userId: consumed.userId } });

  // One Telegram account may only drive one Work Rank identity.
  await PrivateMediaTelegramBinding.update(
    { revokedAt: new Date() },
    { where: { telegramUserId, revokedAt: null } },
  );

  if (existing) {
    await existing.update({
      telegramUserId,
      telegramChatId: String(chatId),
      telegramUsername: telegramUser.username || null,
      revokedAt: null,
    });
  } else {
    await PrivateMediaTelegramBinding.create({
      userId: consumed.userId,
      telegramUserId,
      telegramChatId: String(chatId),
      telegramUsername: telegramUser.username || null,
    });
  }

  await audit.record({
    action: 'TELEGRAM_BOUND',
    actorUserId: consumed.userId,
    targetUserId: consumed.userId,
    source: 'TELEGRAM',
    metadata: { telegramUserId, username: telegramUser.username || null },
  });

  return { ok: true, userId: consumed.userId };
}

async function runCommand(actor, action, payload = {}, identity) {
  const commandId = identity || `tg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const result = await sessionService.issueCommand({
    commandId,
    action,
    source: 'TELEGRAM',
    actorUserId: actor.userId,
    payload,
    room: 'shared',
  });
  if (!result.duplicate) {
    realtime.broadcastCommand(result.command, result.state?.sessionKey);
    realtime.broadcastState(result.state);
  }
  return result;
}

function commandErrorMessage(error) {
  switch (error.code) {
    case 'NO_ACTIVE_MEDIA_SESSION': return 'Chưa có video nào đang phát. Hãy chọn video trong Work Rank trước.';
    case 'NO_NEXT_TRACK': return 'Không còn video tiếp theo trong danh sách.';
    case 'NO_PREVIOUS_TRACK': return 'Không có video trước đó.';
    case 'INVALID_VIDEO_ID': return 'Video không hợp lệ.';
    default: return `Không thực hiện được lệnh (${error.code || 'ERROR'}).`;
  }
}

async function handleMessage(message) {
  const chatId = message.chat?.id;
  const from = message.from;
  const text = String(message.text || '').trim();
  if (!chatId || !from || !text) return;

  const [rawCommand, ...rest] = text.split(/\s+/);
  const command = rawCommand.toLowerCase().replace(/@[\w_]+$/, '');
  const argument = rest.join(' ').trim();

  // /start is the only command that unbound chats may use (that is the bind path).
  if (command === '/start') {
    if (argument) {
      const result = await bindChat({ code: argument, telegramUser: from, chatId });
      if (result.ok) {
        await sendMessage(chatId, '✅ Đã liên kết Telegram với Work Rank.\nBạn có thể dùng /now, /play, /pause, /stop, /search.', controlKeyboard());
      } else if (result.reason === 'NO_ACCESS') {
        await sendMessage(chatId, '⛔ Tài khoản Work Rank này không có quyền điều khiển media.');
      } else {
        await sendMessage(chatId, '❌ Mã liên kết không đúng hoặc đã hết hạn. Tạo mã mới trong Work Rank.');
      }
      return;
    }
    await sendMessage(
      chatId,
      'Đây là bot điều khiển media riêng tư.\nMở Work Rank → Điều khiển media → Liên kết Telegram để lấy mã, sau đó gửi:\n/start <mã>',
    );
    return;
  }

  const actor = await resolveActor(from.id);
  if (!actor.ok) {
    if (actor.reason === 'NO_ACCESS') {
      await sendMessage(chatId, '⛔ Quyền điều khiển của bạn đã bị thu hồi hoặc chưa được cấp.');
    } else {
      await sendMessage(chatId, 'Tài khoản Telegram này chưa được liên kết. Dùng /start <mã> để liên kết.');
    }
    return;
  }

  try {
    switch (command) {
      case '/now': {
        const state = await sessionService.getSessionState(actor.userId, 'shared');
        await sendMessage(chatId, describeState(state), controlKeyboard());
        return;
      }
      case '/play':
      case '/pause':
      case '/stop':
      case '/next':
      case '/toggle': {
        const action = command === '/play' ? 'PLAY' : command === '/pause' ? 'PAUSE' : command === '/stop' ? 'STOP' : command === '/next' ? 'NEXT' : 'TOGGLE_PLAY_PAUSE';
        const result = await runCommand(actor, action, {}, `tg_msg_${chatId}_${message.message_id}`);
        await sendMessage(chatId, describeState(result.state), controlKeyboard());
        return;
      }
      case '/queue': {
        const state = await sessionService.getSessionState(actor.userId, 'shared');
        await sendMessage(chatId, describeQueue(state));
        return;
      }
      case '/search': {
        if (!argument) {
          await sendMessage(chatId, 'Dùng: /search <từ khoá>');
          return;
        }
        const results = await youtube.search({ query: argument, limit: 6 });
        if (!results.items.length) {
          await sendMessage(chatId, 'Không tìm thấy video phù hợp.');
          return;
        }
        await sendMessage(
          chatId,
          `Kết quả cho "${argument}":`,
          {
            inline_keyboard: results.items.flatMap((item) => ([
              [{ text: `${item.title || item.videoId}`.slice(0, 60), callback_data: `pm:add:${item.videoId}` }],
              [{ text: '➕ Thêm vào hàng chờ', callback_data: `pm:add:${item.videoId}` }, { text: '▶ Phát ngay', callback_data: `pm:load:${item.videoId}` }],
            ])),
          },
        );
        return;
      }
      default:
        await sendMessage(chatId, 'Lệnh hỗ trợ: /now /queue /next /play /pause /toggle /stop /search <từ khoá>');
    }
  } catch (error) {
    if (error?.code && commandErrorMessage(error) !== `Không thực hiện được lệnh (${error.code}).`) {
      await sendMessage(chatId, commandErrorMessage(error));
      return;
    }
    if (error?.code === 'YOUTUBE_SEARCH_UNAVAILABLE') {
      await sendMessage(chatId, '⚠️ Chưa cấu hình YOUTUBE_API_KEY nên bot không tìm kiếm được. Bạn vẫn có thể chọn video trong Work Rank.');
      return;
    }
    console.error('[private-media][telegram] command failed:', command, error.message);
    await sendMessage(chatId, 'Không thực hiện được lệnh. Vui lòng thử lại.');
  }
}

async function handleCallbackQuery(query) {
  const data = String(query.data || '');
  const from = query.from;
  const chatId = query.message?.chat?.id;

  try {
    await callApi('answerCallbackQuery', { callback_query_id: query.id });
  } catch {
    // Answering is cosmetic.
  }

  const actor = await resolveActor(from?.id);
  if (!actor.ok) {
    if (chatId) {
      await sendMessage(chatId, actor.reason === 'NO_ACCESS'
        ? '⛔ Quyền điều khiển của bạn đã bị thu hồi hoặc chưa được cấp.'
        : 'Tài khoản Telegram này chưa được liên kết. Dùng /start <mã> để liên kết.');
    }
    return;
  }

  try {
    if (data === 'pm:play' || data === 'pm:pause' || data === 'pm:stop' || data === 'pm:toggle' || data === 'pm:next') {
      const action = data === 'pm:play' ? 'PLAY' : data === 'pm:pause' ? 'PAUSE' : data === 'pm:stop' ? 'STOP' : data === 'pm:next' ? 'NEXT' : 'TOGGLE_PLAY_PAUSE';
      const result = await runCommand(actor, action, {}, `tg_cb_${query.id}`);
      if (chatId) await sendMessage(chatId, describeState(result.state), controlKeyboard());
      return;
    }

    if (data.startsWith('pm:load:') || data.startsWith('pm:add:')) {
      const videoId = data.split(':')[2];
      const video = await youtube.resolveVideo(videoId);
      const result = await runCommand(actor, data.startsWith('pm:add:') ? 'QUEUE_ADD' : 'LOAD_VIDEO', video, `tg_cb_${query.id}`);
      if (chatId) await sendMessage(chatId, describeState(result.state), controlKeyboard());
    }
  } catch (error) {
    if (chatId) await sendMessage(chatId, commandErrorMessage(error));
  }
}

async function handleUpdate(update) {
  if (update.message) return handleMessage(update.message);
  if (update.callback_query) return handleCallbackQuery(update.callback_query);
  return undefined;
}

async function pollLoop() {
  while (running) {
    try {
      const updates = await callApi('getUpdates', {
        offset,
        timeout: POLL_TIMEOUT_SECONDS,
        allowed_updates: ['message', 'callback_query'],
      });

      if (Array.isArray(updates)) {
        for (const update of updates) {
          offset = Math.max(offset, Number(update.update_id) + 1);
          try {
            await handleUpdate(update);
          } catch (error) {
            console.error('[private-media][telegram] update failed:', error.message);
          }
        }
      }
      lastError = null;
    } catch (error) {
      lastError = error.message;
      if (error.telegramCode === 409) {
        console.error('[private-media][telegram] webhook conflict — remove the webhook or use a dedicated bot. Polling stopped.');
        running = false;
        break;
      }
      if (error.telegramCode === 401) {
        console.error('[private-media][telegram] invalid bot token — polling stopped.');
        running = false;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, ERROR_BACKOFF_MS));
    }
  }
  polling = false;
}

async function start() {
  if (!isEnabled() || running) return getStatus();
  running = true;
  polling = true;
  try {
    botInfo = await callApi('getMe');
  } catch (error) {
    lastError = error.message;
    console.error('[private-media][telegram] getMe failed:', error.message);
  }
  loopPromise = pollLoop().catch((error) => {
    console.error('[private-media][telegram] poll loop crashed:', error.message);
  });
  return getStatus();
}

async function stop() {
  running = false;
  if (loopPromise) await loopPromise.catch(() => {});
  loopPromise = null;
  polling = false;
}

function getStatus() {
  return {
    enabled: isEnabled(),
    running,
    polling,
    botUsername: botInfo?.username || null,
    lastError,
  };
}

async function unbindUser(userId) {
  const binding = await PrivateMediaTelegramBinding.findOne({ where: { userId, revokedAt: null } });
  if (!binding) return null;
  await binding.update({ revokedAt: new Date() });
  return binding;
}

async function getBinding(userId) {
  const binding = await PrivateMediaTelegramBinding.findOne({ where: { userId, revokedAt: null } });
  if (!binding) return null;
  return {
    telegramUserId: binding.telegramUserId,
    username: binding.telegramUsername || null,
    linkedAt: binding.createdAt,
  };
}

async function createBindingCode(userId) {
  return pairing.createCode({ userId, purpose: pairing.PURPOSES.TELEGRAM, label: 'telegram' });
}

module.exports = {
  isEnabled,
  start,
  stop,
  getStatus,
  getBinding,
  unbindUser,
  createBindingCode,
  resolveActor,
  describeState,
  describeQueue,
  controlKeyboard,
  // exported for tests
  handleUpdate,
  handleMessage,
  handleCallbackQuery,
};

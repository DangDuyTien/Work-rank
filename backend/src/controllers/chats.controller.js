const chatService = require('../services/chat.service');

function getDatabaseErrorMessage(error) {
  const raw = error?.parent?.sqlMessage || error?.original?.sqlMessage || error?.message || '';
  const code = error?.parent?.code || error?.original?.code || error?.code || '';
  const text = `${code} ${raw}`;

  if (/chat_messages/i.test(text) && /doesn't exist|not exist|no such table|ER_NO_SUCH_TABLE/i.test(text)) {
    return 'Bảng chat_messages chưa tồn tại trên database. Hãy chạy migration tạo bảng chat_messages rồi deploy lại.';
  }

  if (/chat_messages/i.test(text) && /Unknown column|ER_BAD_FIELD_ERROR/i.test(text)) {
    return `Bảng chat_messages đang thiếu hoặc sai tên cột: ${raw}`;
  }

  return '';
}

function handleChatError(error, res) {
  if (error.status) return res.status(error.status).json({ message: error.message });
  const databaseMessage = getDatabaseErrorMessage(error);
  if (databaseMessage) return res.status(500).json({ message: databaseMessage });
  throw error;
}

async function listMessages(req, res) {
  try {
    const payload = await chatService.listMessages(req.user.id, req.params.friendId, {
      beforeId: req.query.beforeId,
      limit: req.query.limit,
    });
    return res.json(payload);
  } catch (error) {
    return handleChatError(error, res);
  }
}

async function sendMessage(req, res) {
  try {
    const data = await chatService.sendMessage(
      req.user.id,
      req.params.friendId,
      req.body?.body,
      req.body?.clientMessageId,
    );
    return res.status(201).json({ data });
  } catch (error) {
    return handleChatError(error, res);
  }
}

async function unreadCounts(req, res) {
  try {
    const data = await chatService.unreadCounts(req.user.id);
    return res.json({ data });
  } catch (error) {
    return handleChatError(error, res);
  }
}

async function markRead(req, res) {
  try {
    const data = await chatService.markRead(req.user.id, req.params.friendId);
    return res.json({ data });
  } catch (error) {
    return handleChatError(error, res);
  }
}

module.exports = {
  listMessages,
  markRead,
  sendMessage,
  unreadCounts,
};

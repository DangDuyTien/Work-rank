const friendService = require('../services/friend.service');

function getDatabaseErrorMessage(error) {
  const raw = error?.parent?.sqlMessage || error?.original?.sqlMessage || error?.message || '';
  const code = error?.parent?.code || error?.original?.code || error?.code || '';
  const text = `${code} ${raw}`;

  if (/friendships/i.test(text) && /doesn't exist|not exist|no such table|ER_NO_SUCH_TABLE/i.test(text)) {
    return 'Bảng friendships chưa tồn tại trên database. Hãy chạy SQL tạo bảng friendships rồi deploy lại.';
  }

  if (/friendships/i.test(text) && /Unknown column|ER_BAD_FIELD_ERROR/i.test(text)) {
    return `Bảng friendships đang thiếu hoặc sai tên cột: ${raw}`;
  }

  return '';
}

function handleFriendError(error, res) {
  if (error.status) return res.status(error.status).json({ message: error.message });
  const databaseMessage = getDatabaseErrorMessage(error);
  if (databaseMessage) return res.status(500).json({ message: databaseMessage });
  throw error;
}

async function list(req, res) {
  try {
    const data = await friendService.listFriends(req.user.id);
    return res.json({ data });
  } catch (error) {
    return handleFriendError(error, res);
  }
}

async function requests(req, res) {
  try {
    const data = await friendService.listRequests(req.user.id);
    return res.json(data);
  } catch (error) {
    return handleFriendError(error, res);
  }
}

async function sendRequest(req, res) {
  try {
    const data = await friendService.sendRequest(req.user.id, req.body?.userId);
    return res.status(data.status === 'accepted' ? 200 : 201).json({ data });
  } catch (error) {
    return handleFriendError(error, res);
  }
}

async function accept(req, res) {
  try {
    const data = await friendService.acceptRequest(req.user.id, req.params.id);
    return res.json({ data });
  } catch (error) {
    return handleFriendError(error, res);
  }
}

async function decline(req, res) {
  try {
    await friendService.declineRequest(req.user.id, req.params.id);
    return res.status(204).send();
  } catch (error) {
    return handleFriendError(error, res);
  }
}

async function cancel(req, res) {
  try {
    await friendService.cancelRequest(req.user.id, req.params.id);
    return res.status(204).send();
  } catch (error) {
    return handleFriendError(error, res);
  }
}

async function remove(req, res) {
  try {
    await friendService.removeFriend(req.user.id, req.params.userId);
    return res.status(204).send();
  } catch (error) {
    return handleFriendError(error, res);
  }
}

module.exports = {
  accept,
  cancel,
  decline,
  list,
  remove,
  requests,
  sendRequest,
};

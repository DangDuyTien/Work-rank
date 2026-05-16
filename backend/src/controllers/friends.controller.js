const friendService = require('../services/friend.service');

function handleFriendError(error, res) {
  if (error.status) return res.status(error.status).json({ message: error.message });
  throw error;
}

async function list(req, res) {
  const data = await friendService.listFriends(req.user.id);
  return res.json({ data });
}

async function requests(req, res) {
  const data = await friendService.listRequests(req.user.id);
  return res.json(data);
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

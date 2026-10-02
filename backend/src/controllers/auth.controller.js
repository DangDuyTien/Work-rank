const authService = require('../services/auth.service');
const userDeletionService = require('../services/userDeletion.service');

async function register(req, res) {
  const result = await authService.register(req.validated.body);
  res.status(201).json(result);
}

async function login(req, res) {
  const result = await authService.login(req.validated.body);
  res.json(result);
}

async function refreshToken(req, res) {
  const result = await authService.refresh(req.validated.body.refreshToken);
  res.json(result);
}

async function logout(req, res) {
  await authService.logout(req.user);
  res.status(204).send();
}

async function me(req, res) {
  res.json({ user: await authService.userPayload(req.user) });
}

async function updateMe(req, res) {
  const result = await authService.updateProfile(req.user, req.validated.body);
  res.json(result);
}

async function changePassword(req, res) {
  const result = await authService.changePassword(req.user, req.validated.body);
  res.json(result);
}

async function deleteMe(req, res) {
  const result = await userDeletionService.deleteUserAccount({
    targetUserId: req.user.id,
    actorUser: req.user,
    isSelfDelete: true,
    req,
  });
  res.json({ message: 'Tài khoản của bạn đã được xóa thành công.', ...result });
}

module.exports = { register, login, refreshToken, logout, me, updateMe, changePassword, deleteMe };

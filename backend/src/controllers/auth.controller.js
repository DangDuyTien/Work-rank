const authService = require('../services/auth.service');
const sanitizeUser = require('../utils/sanitizeUser');

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
  res.json({ user: sanitizeUser(req.user) });
}

module.exports = { register, login, refreshToken, logout, me };

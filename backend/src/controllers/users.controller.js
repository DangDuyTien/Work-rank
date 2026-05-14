const bcrypt = require('bcryptjs');
const env = require('../config/env');
const { User } = require('../models');
const sanitizeUser = require('../utils/sanitizeUser');
const { decorateUserPresence } = require('../services/userPresence.service');

async function list(req, res) {
  const users = await User.findAll({ order: [['createdAt', 'DESC']] });
  res.json({ data: users.map((user) => decorateUserPresence(sanitizeUser(user))) });
}

async function getById(req, res) {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  return res.json({ user: decorateUserPresence(sanitizeUser(user)) });
}

async function create(req, res) {
  const passwordHash = await bcrypt.hash(req.body.password, env.bcryptRounds);
  const user = await User.create({ ...req.body, passwordHash });
  res.status(201).json({ user: sanitizeUser(user) });
}

async function update(req, res) {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  await user.update(req.body);
  return res.json({ user: sanitizeUser(user) });
}

async function remove(req, res) {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  await user.update({ status: 'inactive' });
  return res.status(204).send();
}

module.exports = { list, getById, create, update, remove };

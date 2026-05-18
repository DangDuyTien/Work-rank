const groupService = require('../services/group.service');

async function list(req, res) {
  res.json({ data: await groupService.listForUser(req.user) });
}

async function create(req, res) {
  const group = await groupService.create(req.user, req.body);
  res.status(201).json({ group, data: group });
}

async function join(req, res) {
  const group = await groupService.join(req.user, req.body.inviteCode || req.body.invite_code);
  res.json({ group, data: group });
}

async function leave(req, res) {
  await groupService.leave(req.user, req.params.id);
  res.status(204).send();
}

async function update(req, res) {
  const group = await groupService.update(req.user, req.params.id, req.body);
  res.json({ group, data: group });
}

async function remove(req, res) {
  await groupService.remove(req.user, req.params.id);
  res.status(204).send();
}

async function kick(req, res) {
  const group = await groupService.kick(req.user, req.params.id, req.body.userId || req.body.user_id);
  res.json({ group, data: group });
}

module.exports = { list, create, join, leave, update, remove, kick };

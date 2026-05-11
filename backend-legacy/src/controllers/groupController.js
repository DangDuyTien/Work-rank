const groupService = require('../services/groupService');

exports.create = async (req, res) => {
  try {
    const group = await groupService.createGroup(req.user.id, req.body);
    res.status(201).json(group);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.list = async (req, res) => {
  try {
    const groups = await groupService.getMyGroups(req.user.id);
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.get = async (req, res) => {
  try {
    const group = await groupService.getGroupById(Number(req.params.id), req.user.id);
    if (!group) return res.status(404).json({ error: 'Nhóm không tồn tại' });
    res.json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const result = await groupService.updateGroup(Number(req.params.id), req.user.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const result = await groupService.deleteGroup(Number(req.params.id), req.user.id);
    res.json(result);
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
};

exports.join = async (req, res) => {
  try {
    const result = await groupService.joinByInviteCode(req.user.id, req.body.invite_code);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.leave = async (req, res) => {
  try {
    const result = await groupService.leaveGroup(Number(req.params.id), req.user.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.kick = async (req, res) => {
  try {
    const result = await groupService.kickMember(Number(req.params.id), req.user.id, Number(req.params.userId));
    res.json(result);
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
};

exports.refreshInvite = async (req, res) => {
  try {
    const result = await groupService.refreshInviteCode(Number(req.params.id), req.user.id);
    res.json(result);
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
};

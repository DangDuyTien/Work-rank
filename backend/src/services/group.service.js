const crypto = require('crypto');
const { Team, User } = require('../models');

function makeInviteCode() {
  return `WR-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

async function ensureInviteCode(team) {
  if (team.inviteCode) return team;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await team.update({ inviteCode: makeInviteCode() });
      return team;
    } catch (error) {
      if (error.name !== 'SequelizeUniqueConstraintError') throw error;
    }
  }
  const error = new Error('Could not generate invite code');
  error.statusCode = 500;
  throw error;
}

async function toGroupPayload(team, userId) {
  await ensureInviteCode(team);
  const memberWhere = { teamId: team.id, status: 'active' };
  const [memberCount, members] = await Promise.all([
    User.count({ where: memberWhere }),
    User.findAll({
      where: memberWhere,
      attributes: ['id', 'name', 'email', 'role', 'isVerified', 'status'],
      order: [
        ['name', 'ASC'],
        ['id', 'ASC'],
      ],
      limit: 100,
    }),
  ]);
  return {
    id: team.id,
    name: team.name,
    description: team.description,
    invite_code: team.inviteCode,
    inviteCode: team.inviteCode,
    owner_id: team.ownerId,
    ownerId: team.ownerId,
    member_count: memberCount,
    memberCount,
    members: members.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      isVerified: member.isVerified,
      status: member.status,
      groupRole: String(team.ownerId || '') === String(member.id) ? 'owner' : 'member',
    })),
    role: String(team.ownerId || '') === String(userId) ? 'owner' : 'member',
  };
}

async function loadTeamOrThrow(teamId) {
  const team = await Team.findByPk(teamId);
  if (!team) {
    const error = new Error('Group not found');
    error.statusCode = 404;
    throw error;
  }
  return team;
}

function assertCanManage(user, team) {
  const isOwner = String(team.ownerId || '') === String(user.id);
  const isAdmin = user.role === 'admin';
  if (isOwner || isAdmin) return;
  const error = new Error('Only group owner or admin can manage this group');
  error.statusCode = 403;
  throw error;
}

function normalizeName(value) {
  return String(value || '').trim();
}

function normalizeDescription(value) {
  const description = String(value || '').trim();
  return description || null;
}

async function listForUser(user) {
  if (!user.teamId) return [];
  const team = await Team.findByPk(user.teamId);
  if (!team) return [];
  return [await toGroupPayload(team, user.id)];
}

async function create(user, payload) {
  const team = await Team.create({
    name: payload.name,
    description: payload.description || null,
    inviteCode: makeInviteCode(),
    ownerId: user.id,
  });
  await user.update({ teamId: team.id });
  return toGroupPayload(team, user.id);
}

async function join(user, inviteCode) {
  const team = await Team.findOne({ where: { inviteCode } });
  if (!team) {
    const error = new Error('Invalid invite code');
    error.statusCode = 404;
    throw error;
  }
  await user.update({ teamId: team.id });
  return toGroupPayload(team, user.id);
}

async function leave(user, teamId) {
  if (String(user.teamId || '') !== String(teamId)) {
    const error = new Error('User is not in this group');
    error.statusCode = 400;
    throw error;
  }
  const team = await loadTeamOrThrow(teamId);
  if (String(team.ownerId || '') === String(user.id)) {
    const error = new Error('Group owner must delete the group before leaving');
    error.statusCode = 400;
    throw error;
  }
  await user.update({ teamId: null });
  return { ok: true };
}

async function update(user, teamId, payload = {}) {
  const team = await loadTeamOrThrow(teamId);
  assertCanManage(user, team);
  const updates = {};
  if (payload.name !== undefined) {
    const name = normalizeName(payload.name);
    if (!name) {
      const error = new Error('Group name is required');
      error.statusCode = 400;
      throw error;
    }
    updates.name = name;
  }
  if (payload.description !== undefined) updates.description = normalizeDescription(payload.description);
  if (Object.keys(updates).length > 0) {
    try {
      await team.update(updates);
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        const conflict = new Error('Group name already exists');
        conflict.statusCode = 409;
        throw conflict;
      }
      throw error;
    }
  }
  return toGroupPayload(team, user.id);
}

async function remove(user, teamId) {
  const team = await loadTeamOrThrow(teamId);
  assertCanManage(user, team);
  await User.update({ teamId: null }, { where: { teamId: team.id } });
  await team.destroy();
  return { ok: true };
}

async function kick(user, teamId, targetUserId) {
  const team = await loadTeamOrThrow(teamId);
  assertCanManage(user, team);
  if (String(team.ownerId || '') === String(targetUserId)) {
    const error = new Error('Group owner cannot be kicked');
    error.statusCode = 400;
    throw error;
  }
  const target = await User.findByPk(targetUserId);
  if (!target || String(target.teamId || '') !== String(team.id)) {
    const error = new Error('User is not in this group');
    error.statusCode = 404;
    throw error;
  }
  await target.update({ teamId: null });
  return toGroupPayload(team, user.id);
}

module.exports = { listForUser, create, join, leave, update, remove, kick };

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
  const memberCount = await User.count({ where: { teamId: team.id, status: 'active' } });
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
    role: String(team.ownerId || '') === String(userId) ? 'owner' : 'member',
  };
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
  await user.update({ teamId: null });
  return { ok: true };
}

module.exports = { listForUser, create, join, leave };

const crypto = require('crypto');
const { Team, User, UserProfilePreference } = require('../models');

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
  const [memberCount, members, owner] = await Promise.all([
    User.count({ where: memberWhere }),
    User.findAll({
      where: memberWhere,
      attributes: ['id', 'name', 'email', 'role', 'jobTitle', 'department', 'isVerified', 'isDev', 'status', 'lastSeenAt'],
      include: [
        { model: UserProfilePreference, attributes: ['avatarData', 'featuredBadges'], required: false },
      ],
      order: [
        ['name', 'ASC'],
        ['id', 'ASC'],
      ],
      limit: 100,
    }),
    team.ownerId ? User.findByPk(team.ownerId, {
      attributes: ['id', 'name', 'email', 'jobTitle', 'department', 'isVerified', 'isDev'],
      include: [
        { model: UserProfilePreference, attributes: ['avatarData', 'featuredBadges'], required: false },
      ],
    }) : null,
  ]);
  const ownerPref = owner?.UserProfilePreference || owner?.userProfilePreference;
  return {
    id: team.id,
    name: team.name,
    description: team.description,
    invite_code: team.inviteCode,
    inviteCode: team.inviteCode,
    owner_id: team.ownerId,
    ownerId: team.ownerId,
    owner: owner ? {
      id: owner.id,
      name: owner.name,
      email: owner.email,
      jobTitle: owner.jobTitle || 'Nhân viên',
      department: owner.department || 'Media & Content',
      isVerified: Boolean(owner.isVerified),
      isDev: Boolean(owner.isDev),
      avatarData: ownerPref?.avatarData || null,
      userAvatar: ownerPref?.avatarData || null,
    } : null,
    member_count: memberCount,
    memberCount,
    members: members.map((member) => {
      const pref = member.UserProfilePreference || member.userProfilePreference;
      return {
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        jobTitle: member.jobTitle || 'Nhân viên',
        department: member.department || 'Media & Content',
        isVerified: Boolean(member.isVerified),
        isDev: Boolean(member.isDev),
        status: member.status,
        lastSeenAt: member.lastSeenAt,
        avatarData: pref?.avatarData || null,
        userAvatar: pref?.avatarData || null,
        featuredBadges: Array.isArray(pref?.featuredBadges) ? pref.featuredBadges : [],
        groupRole: String(team.ownerId || '') === String(member.id) ? 'owner' : 'member',
        isLeader: String(team.ownerId || '') === String(member.id),
      };
    }),
    role: String(team.ownerId || '') === String(userId) ? 'owner' : 'member',
    isLeader: String(team.ownerId || '') === String(userId),
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

async function listAllTeams() {
  const teams = await Team.findAll({
    order: [['name', 'ASC']],
    include: [
      { model: User, as: 'Owner', attributes: ['id', 'name', 'email', 'jobTitle', 'department', 'isVerified'] },
    ],
  });
  const teamsWithCounts = await Promise.all(teams.map(async (t) => {
    const count = await User.count({ where: { teamId: t.id, status: 'active' } });
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      inviteCode: t.inviteCode,
      ownerId: t.ownerId,
      owner: t.Owner ? {
        id: t.Owner.id,
        name: t.Owner.name,
        email: t.Owner.email,
        jobTitle: t.Owner.jobTitle,
        department: t.Owner.department,
        isVerified: t.Owner.isVerified,
      } : null,
      memberCount: count,
    };
  }));
  return teamsWithCounts;
}

async function create(user, payload) {
  let ownerId = payload.ownerId || payload.owner_id;
  if (!ownerId && user.role !== 'admin') {
    ownerId = user.id;
  }
  const team = await Team.create({
    name: payload.name,
    description: payload.description || null,
    inviteCode: makeInviteCode(),
    ownerId: ownerId || null,
  });
  if (user.role !== 'admin' || payload.assignToUser === true) {
    await user.update({ teamId: team.id });
  }
  if (ownerId && String(ownerId) !== String(user.id)) {
    await User.update({ teamId: team.id }, { where: { id: ownerId } });
  }
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
  const targetOwnerId = payload.ownerId !== undefined ? payload.ownerId : payload.owner_id;
  if (targetOwnerId !== undefined) {
    if (targetOwnerId === null || targetOwnerId === 0 || targetOwnerId === '') {
      updates.ownerId = null;
    } else {
      const newOwner = await User.findByPk(targetOwnerId);
      if (newOwner) {
        updates.ownerId = newOwner.id;
        if (newOwner.teamId !== team.id) {
          await newOwner.update({ teamId: team.id });
        }
      }
    }
  }
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

async function addMember(user, teamId, targetUserId) {
  const team = await loadTeamOrThrow(teamId);
  assertCanManage(user, team);
  const target = await User.findByPk(targetUserId);
  if (!target || target.status === 'inactive') {
    const error = new Error('Thành viên không tồn tại hoặc tài khoản đã bị vô hiệu hóa');
    error.statusCode = 404;
    throw error;
  }
  if (target.teamId) {
    if (String(target.teamId) === String(team.id)) {
      const error = new Error('Thành viên này đã ở trong đội');
      error.statusCode = 400;
      throw error;
    }
    if (user.role === 'admin') {
      // Admin có quyền chuyển thành viên từ đội khác sang đội này
      await target.update({ teamId: team.id });
      return toGroupPayload(team, user.id);
    }
    const error = new Error('Thành viên này đang thuộc một đội khác');
    error.statusCode = 400;
    throw error;
  }
  await target.update({ teamId: team.id });
  return toGroupPayload(team, user.id);
}

module.exports = { listForUser, listAllTeams, create, join, leave, update, remove, kick, addMember };

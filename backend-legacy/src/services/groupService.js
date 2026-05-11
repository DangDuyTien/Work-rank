const pool = require('../config/database');
const crypto = require('crypto');

// Generate a short invite code like "WR-A3Kf9x"
const generateInviteCode = () => {
  return 'WR-' + crypto.randomBytes(4).toString('base64url').slice(0, 6);
};

// ── CRUD ──

const createGroup = async (ownerId, { name, description, max_members }) => {
  const invite_code = generateInviteCode();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      'INSERT INTO `groups` (name, description, invite_code, owner_id, max_members) VALUES (?, ?, ?, ?, ?)',
      [name, description || null, invite_code, ownerId, max_members || 50]
    );
    const groupId = result.insertId;

    // Owner is automatically a member with role 'owner'
    await conn.query(
      'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
      [groupId, ownerId, 'owner']
    );

    await conn.commit();
    return { id: groupId, name, description, invite_code, owner_id: ownerId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const getMyGroups = async (userId) => {
  const [rows] = await pool.query(
    `SELECT g.*, gm.role, 
       (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
     FROM \`groups\` g
     JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?
     ORDER BY g.updated_at DESC`,
    [userId]
  );
  return rows;
};

const getGroupById = async (groupId, requestingUserId) => {
  const [groups] = await pool.query(
    'SELECT * FROM `groups` WHERE id = ?',
    [groupId]
  );
  if (groups.length === 0) return null;

  const group = groups[0];

  // Check if requesting user is a member
  const [membership] = await pool.query(
    'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
    [groupId, requestingUserId]
  );
  group.my_role = membership.length > 0 ? membership[0].role : null;
  group.is_member = membership.length > 0;

  // Get all members
  const [members] = await pool.query(
    `SELECT u.id, u.name, u.email, u.avatar, u.status, gm.role, gm.joined_at
     FROM group_members gm
     JOIN users u ON gm.user_id = u.id
     WHERE gm.group_id = ?
     ORDER BY FIELD(gm.role, 'owner', 'admin', 'member'), gm.joined_at ASC`,
    [groupId]
  );
  group.members = members;
  group.member_count = members.length;

  return group;
};

const updateGroup = async (groupId, userId, { name, description, max_members }) => {
  // Only owner or admin can update
  const [membership] = await pool.query(
    "SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND role IN ('owner', 'admin')",
    [groupId, userId]
  );
  if (membership.length === 0) throw new Error('Không có quyền chỉnh sửa');

  await pool.query(
    'UPDATE `groups` SET name = COALESCE(?, name), description = COALESCE(?, description), max_members = COALESCE(?, max_members) WHERE id = ?',
    [name, description, max_members, groupId]
  );
  return { success: true };
};

const deleteGroup = async (groupId, userId) => {
  const [groups] = await pool.query(
    'SELECT owner_id FROM `groups` WHERE id = ?', [groupId]
  );
  if (groups.length === 0) throw new Error('Nhóm không tồn tại');
  if (groups[0].owner_id !== userId) throw new Error('Chỉ chủ nhóm mới có quyền xóa');

  await pool.query('DELETE FROM `groups` WHERE id = ?', [groupId]);
  return { success: true };
};

// ── MEMBERSHIP ──

const joinByInviteCode = async (userId, inviteCode) => {
  const [groups] = await pool.query(
    'SELECT id, max_members FROM `groups` WHERE invite_code = ?',
    [inviteCode]
  );
  if (groups.length === 0) throw new Error('Mã mời không hợp lệ');

  const group = groups[0];

  // Check if already member
  const [existing] = await pool.query(
    'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
    [group.id, userId]
  );
  if (existing.length > 0) throw new Error('Bạn đã là thành viên nhóm này');

  // Check member limit
  const [countResult] = await pool.query(
    'SELECT COUNT(*) as cnt FROM group_members WHERE group_id = ?',
    [group.id]
  );
  if (countResult[0].cnt >= group.max_members) throw new Error('Nhóm đã đầy');

  await pool.query(
    'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
    [group.id, userId, 'member']
  );
  return { group_id: group.id, success: true };
};

const leaveGroup = async (groupId, userId) => {
  // Owner cannot leave, must delete or transfer
  const [membership] = await pool.query(
    'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
    [groupId, userId]
  );
  if (membership.length === 0) throw new Error('Bạn không phải thành viên');
  if (membership[0].role === 'owner') throw new Error('Chủ nhóm không thể rời nhóm. Hãy xóa nhóm hoặc chuyển quyền.');

  await pool.query(
    'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
    [groupId, userId]
  );
  return { success: true };
};

const kickMember = async (groupId, requesterId, targetUserId) => {
  const [requesterRole] = await pool.query(
    "SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND role IN ('owner', 'admin')",
    [groupId, requesterId]
  );
  if (requesterRole.length === 0) throw new Error('Không có quyền');

  const [targetRole] = await pool.query(
    'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
    [groupId, targetUserId]
  );
  if (targetRole.length === 0) throw new Error('Người dùng không trong nhóm');
  if (targetRole[0].role === 'owner') throw new Error('Không thể kick chủ nhóm');

  await pool.query(
    'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
    [groupId, targetUserId]
  );
  return { success: true };
};

const refreshInviteCode = async (groupId, userId) => {
  const [groups] = await pool.query(
    'SELECT owner_id FROM `groups` WHERE id = ?', [groupId]
  );
  if (groups.length === 0) throw new Error('Nhóm không tồn tại');
  if (groups[0].owner_id !== userId) throw new Error('Chỉ chủ nhóm mới có quyền');

  const newCode = generateInviteCode();
  await pool.query('UPDATE `groups` SET invite_code = ? WHERE id = ?', [newCode, groupId]);
  return { invite_code: newCode };
};

module.exports = {
  createGroup, getMyGroups, getGroupById, updateGroup, deleteGroup,
  joinByInviteCode, leaveGroup, kickMember, refreshInviteCode,
};

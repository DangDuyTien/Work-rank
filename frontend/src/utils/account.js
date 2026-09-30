/**
 * Account and Profile Utility Functions for WorkRank
 */

export function isVerifiedAccount(user) {
  if (!user) return false;
  return Boolean(
    user.is_verified ||
    user.verified ||
    user.isVerified ||
    user.has_tick ||
    user.tick ||
    user.blue_tick
  );
}

export function getAccountRoleLabel(role) {
  switch (role) {
    case 'admin':
      return 'Quản Trị Viên';
    case 'superadmin':
      return 'Tổng Quản Trị';
    case 'moderator':
      return 'Điều Hành Viên';
    default:
      return 'Thành Viên';
  }
}

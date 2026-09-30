import {
  Activity,
  Trophy,
  Users,
  Swords,
  Crown,
  Flame,
  Calendar,
  Award,
  Shield,
  BadgeCheck,
  User,
  Tv,
  Building2,
  Gamepad2,
  Sparkles,
  Settings as SettingsIcon,
} from 'lucide-react';

/**
 * Authoritative Navigation Hierarchy for WorkRank V3.3.
 *
 * Groups all active platform routes into clean, logical parent-child categories:
 * - Overview (Dashboard, YouTube Analytics, Leaderboard)
 * - Competition (Arena, Grand Championship, Friends / Teams)
 * - Games (Capital Board Game)
 * - Admin (People & Privileges, Teams & YouTube, Seasons, Grand Championship, Operations & Logs)
 * - Account (Profile, Settings)
 */
export const NAVIGATION_CONFIG = [
  {
    id: 'overview',
    label: 'Tổng Quan & Sản Lượng',
    icon: Activity,
    collapsible: false,
    items: [
      {
        to: '/dashboard',
        label: 'Bảng Điều Khiển',
        shortLabel: 'Tổng quan',
        icon: Activity,
        tourTarget: 'nav-dashboard',
        description: 'Chỉ số hiệu suất thi đấu và hoạt động theo thời gian thực',
      },
      {
        to: '/youtube',
        label: 'Số Liệu YouTube & Đội Nhóm',
        shortLabel: 'YouTube',
        icon: Tv,
        tourTarget: 'nav-youtube',
        description: 'Thành tích kênh, BXH lượt xem, đăng ký và top video các đội',
      },
      {
        to: '/leaderboard',
        label: 'Bảng Xếp Hạng',
        shortLabel: 'Xếp hạng',
        icon: Trophy,
        tourTarget: 'nav-leaderboard',
        description: 'Bảng xếp hạng cá nhân và phòng ban thi đua',
      },
    ],
  },

  {
    id: 'competition',
    label: 'Giải Đấu & Thi Đua',
    icon: Swords,
    collapsible: true,
    badge: 'Thi Đua',
    items: [
      {
        to: '/arena',
        label: 'Đấu Trường Mùa Giải',
        shortLabel: 'Mùa giải',
        icon: Swords,
        tourTarget: 'nav-arena',
        description: 'Đấu trường mùa giải, thử thách và tiến độ điểm thi đua',
      },
      {
        to: '/grand',
        label: 'Giải Vô Địch Năm (Grand)',
        shortLabel: 'Vô địch năm',
        icon: Crown,
        tourTarget: 'nav-grand',
        description: 'Cuộc đua vô địch năm và bảng xếp hạng điểm tích lũy',
      },
      {
        to: '/friends',
        label: 'Bạn Bè & Đội Nhóm',
        shortLabel: 'Bạn bè',
        icon: Users,
        description: 'Đồng đội, bảng xếp hạng nhóm và tin nhắn nội bộ',
      },
    ],
  },
  {
    id: 'games',
    label: 'Trò Chơi',
    icon: Gamepad2,
    collapsible: true,
    badge: 'Giải Trí',
    items: [
      {
        to: '/games/capital-board',
        label: 'Cờ Tỷ Phú',
        shortLabel: 'Cờ Tỷ Phú',
        icon: Gamepad2,
        tourTarget: 'nav-capital-board',
        description: 'Board game giải trí nội bộ 2–4 người chơi theo lượt',
      },
      {
        to: '/games/quiz',
        label: 'Đoán Hình & Đoán Nhạc',
        shortLabel: 'Đoán Hình & Nhạc',
        icon: Sparkles,
        tourTarget: 'nav-guess-quiz',
        description: 'Mini game đoán hình ảnh & đoán bài hát tốc độ cao',
      },
    ],
  },
  {
    id: 'admin',
    label: 'Quản Trị Hệ Thống',
    icon: Shield,
    adminOnly: true,
    collapsible: true,
    badge: 'Quản Trị',
    items: [
      {
        to: '/admin/privileges',
        label: 'Quản Lý Nhân Sự & Đặc Quyền',
        shortLabel: 'Nhân sự',
        icon: User,
        adminOnly: true,
        description: 'Danh sách nhân viên, gán team/chức danh, cấp tích xanh & trao thưởng',
      },
      {
        to: '/admin/teams-youtube',
        label: 'Quản Lý Đội Nhóm & Kênh YouTube',
        shortLabel: 'Đội & Kênh',
        icon: Building2,
        adminOnly: true,
        description: 'Cấu hình teams, phân bổ phòng ban, kết nối & đồng bộ kênh YouTube',
      },
      {
        to: '/admin/competition/seasons',
        label: 'Quản Lý Mùa Giải',
        shortLabel: 'Mùa giải',
        icon: Calendar,
        adminOnly: true,
        description: 'Cấu hình thời gian, kích hoạt, tạm dừng và kết toán mùa giải',
      },
      {
        to: '/admin/competition/grand',
        label: 'Quản Lý Giải Vô Địch Năm',
        shortLabel: 'Vô địch năm',
        icon: Award,
        adminOnly: true,
        description: 'Thiết lập giải đấu năm và kết toán điểm tích lũy',
      },
      {
        to: '/admin/operations',
        label: 'Giám Sát & Nhật Ký Kiểm Toán',
        shortLabel: 'Giám sát & Logs',
        icon: Flame,
        adminOnly: true,
        description: 'Sức khỏe hệ thống, hàng đợi sự kiện, đồng bộ BXH & Audit Logs',
      },
    ],
  },
  {
    id: 'account',
    label: 'Tài Khoản & Cài Đặt',
    icon: User,
    collapsible: true,
    items: [
      {
        to: (userId) => `/users/${userId || 1}`,
        label: 'Hồ Sơ Cá Nhân',
        shortLabel: 'Hồ sơ',
        icon: User,
        dynamicTo: true,
        description: 'Thông tin cá nhân, vị trí công tác và lịch sử vinh danh',
      },
      {
        to: '/settings',
        label: 'Cài Đặt Hệ Thống',
        shortLabel: 'Cài đặt',
        icon: SettingsIcon,
        description: 'Tùy chỉnh thông báo, âm thanh và đổi mật khẩu bảo mật',
      },
    ],
  },
];

/**
 * Returns true if a given path matches the item's target path.
 */
export function isRouteActive(currentPath, targetPath) {
  if (!targetPath || typeof targetPath !== 'string') return false;
  if (targetPath === '/dashboard') return currentPath === '/dashboard';
  if (targetPath === '/leaderboard' || targetPath === '/rankings') {
    return currentPath === '/leaderboard' || currentPath.startsWith('/leaderboard/') ||
           currentPath === '/rankings' || currentPath.startsWith('/rankings');
  }
  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
}

/**
 * Resolves the target URL for navigation items (handles dynamic functions).
 */
export function resolveItemPath(item, userId) {
  if (typeof item.to === 'function') {
    return item.to(userId);
  }
  return item.to;
}

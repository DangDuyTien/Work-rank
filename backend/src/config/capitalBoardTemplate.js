'use strict';

/**
 * Capital Board Game (Cờ Tỷ Phú WorkRank) V1 Configuration
 * Total Tiles: 28 (indices 0 to 27)
 */

const STARTING_CASH = 1500;
const START_PASS_BONUS = 200;
const TURN_TIMEOUT_SECONDS = 25;
const MAX_TURNS_LIMIT = 50;

const CAREER_REWARDS = {
  FOUR_PLAYERS: { 1: 1000, 2: 600, 3: 300, 4: 150 },
  THREE_PLAYERS: { 1: 1000, 2: 600, 3: 300 },
  TWO_PLAYERS: { 1: 1000, 2: 600 },
};

const SEAT_COLORS = [
  '#38bdf8', // Player 1: Sky Blue
  '#ef4444', // Player 2: Rose Red
  '#10b981', // Player 3: Emerald Green
  '#f59e0b', // Player 4: Amber Gold
];

const PREDEFINED_EVENTS = [
  { id: 'EV_1', title: 'Ký Hợp Đồng Quảng Cáo Lớn', description: 'Kênh của bạn vừa chốt được hợp đồng tài trợ triệu view.', effect: 'ADD_CASH', amount: 150 },
  { id: 'EV_2', title: 'Nâng Cấp Hạ Tầng Máy Chủ', description: 'Chi phí bảo trì và mở rộng hệ thống phòng thu.', effect: 'SUB_CASH', amount: 100 },
  { id: 'EV_3', title: 'Video Đạt Top 1 Thịnh Hành', description: 'Thưởng nóng từ ban giám đốc cho sản phẩm viral.', effect: 'ADD_CASH', amount: 120 },
  { id: 'EV_4', title: 'Tài Trợ Team Building', description: 'Góp quỹ hoạt động giao lưu và gắn kết nội bộ.', effect: 'SUB_CASH', amount: 60 },
  { id: 'EV_5', title: 'Cổ Tức Dự Án Thành Công', description: 'Nhận phần chia lợi nhuận từ dự án trọng điểm quý.', effect: 'ADD_CASH', amount: 180 },
  { id: 'EV_6', title: 'Học Bổng Đào Tạo Kỹ Năng', description: 'Đóng học phí tham gia khóa huấn luyện chuyên sâu.', effect: 'SUB_CASH', amount: 80 },
  { id: 'EV_7', title: 'Vòng Quay May Mắn Công Ty', description: 'Trúng giải thưởng sự kiện bốc thăm may mắn.', effect: 'ADD_CASH', amount: 200 },
  { id: 'EV_8', title: 'Bảo Hành Thiết Bị Quay Phim', description: 'Thay thế ống kính và phụ kiện trường quay.', effect: 'SUB_CASH', amount: 70 },
];

const BOARD_TILES = [
  // Bottom Row: 0 -> 7 (Left to Right)
  { index: 0, type: 'START', key: 'TILE_START', name: 'Khởi Hành', label: 'START', bonus: 200, icon: 'Flag' },
  { index: 1, type: 'PROPERTY', key: 'PROP_MEDIA_1', name: 'Phòng Livestream', group: 'MEDIA', groupName: 'Media Hub', color: '#ec4899', price: 100, rent: 15 },
  { index: 2, type: 'PROPERTY', key: 'PROP_MEDIA_2', name: 'Studio Sáng Tạo', group: 'MEDIA', groupName: 'Media Hub', color: '#ec4899', price: 120, rent: 20 },
  { index: 3, type: 'PROPERTY', key: 'PROP_MEDIA_3', name: 'Đài Truyền Thông', group: 'MEDIA', groupName: 'Media Hub', color: '#ec4899', price: 140, rent: 25 },
  { index: 4, type: 'EVENT', key: 'TILE_EVENT_1', name: 'Cơ Hội Bứt Phá', label: 'CƠ HỘI', icon: 'Sparkles' },
  { index: 5, type: 'PROPERTY', key: 'PROP_TECH_1', name: 'Trung Tâm Dữ Liệu', group: 'TECH', groupName: 'Công Nghệ', color: '#06b6d4', price: 160, rent: 30 },
  { index: 6, type: 'PROPERTY', key: 'PROP_TECH_2', name: 'Phòng Nghiên Cứu AI', group: 'TECH', groupName: 'Công Nghệ', color: '#06b6d4', price: 180, rent: 35 },
  { index: 7, type: 'REST', key: 'TILE_REST', name: 'Khu Nghỉ Dưỡng', label: 'NGHỈ DƯỠNG', icon: 'Coffee' },

  // Right Column: 8 -> 14 (Bottom to Top)
  { index: 8, type: 'PROPERTY', key: 'PROP_TECH_3', name: 'Trụ Sở Cloud Core', group: 'TECH', groupName: 'Công Nghệ', color: '#06b6d4', price: 200, rent: 40 },
  { index: 9, type: 'PROPERTY', key: 'PROP_LOG_1', name: 'Cảng Logistics', group: 'LOGISTICS', groupName: 'Hậu Cần', color: '#3b82f6', price: 220, rent: 45 },
  { index: 10, type: 'PROPERTY', key: 'PROP_LOG_2', name: 'Bến Du Thuyền', group: 'LOGISTICS', groupName: 'Hậu Cần', color: '#3b82f6', price: 240, rent: 50 },
  { index: 11, type: 'TAX', key: 'TILE_TAX_1', name: 'Phí Hạ Tầng Mạng', label: 'PHÍ DỊCH VỤ', taxAmount: 80, icon: 'CreditCard' },
  { index: 12, type: 'PROPERTY', key: 'PROP_LOG_3', name: 'Đảo Hải Đăng', group: 'LOGISTICS', groupName: 'Hậu Cần', color: '#3b82f6', price: 260, rent: 55 },
  { index: 13, type: 'EVENT', key: 'TILE_EVENT_2', name: 'Vận May Khởi Nghiệp', label: 'CƠ HỘI', icon: 'Sparkles' },
  { index: 14, type: 'BONUS', key: 'TILE_BONUS_1', name: 'Kho Báu Doanh Nghiệp', label: 'KHO BÁU', bonus: 150, icon: 'Gift' },

  // Top Row: 15 -> 21 (Right to Left)
  { index: 15, type: 'PROPERTY', key: 'PROP_ECO_1', name: 'Công Viên Xanh', group: 'ECO', groupName: 'Sinh Thái', color: '#10b981', price: 280, rent: 60 },
  { index: 16, type: 'PROPERTY', key: 'PROP_ECO_2', name: 'Thung Lũng Sinh Thái', group: 'ECO', groupName: 'Sinh Thái', color: '#10b981', price: 300, rent: 65 },
  { index: 17, type: 'PROPERTY', key: 'PROP_ECO_3', name: 'Khu Rừng Nguyên Sinh', group: 'ECO', groupName: 'Sinh Thái', color: '#10b981', price: 320, rent: 70 },
  { index: 18, type: 'EVENT', key: 'TILE_EVENT_3', name: 'Cơ Hội Đầu Tư', label: 'CƠ HỘI', icon: 'Sparkles' },
  { index: 19, type: 'PROPERTY', key: 'PROP_FIN_1', name: 'Tháp Tài Chính', group: 'FINANCE', groupName: 'Tài Chính', color: '#f59e0b', price: 340, rent: 75 },
  { index: 20, type: 'PROPERTY', key: 'PROP_FIN_2', name: 'Tòa Nhà Chọc Trời', group: 'FINANCE', groupName: 'Tài Chính', color: '#f59e0b', price: 360, rent: 80 },
  { index: 21, type: 'TAX', key: 'TILE_TAX_2', name: 'Thuế Doanh Nghiệp', label: 'THUẾ QUỸ', taxAmount: 100, icon: 'ShieldAlert' },

  // Left Column: 22 -> 27 (Top to Bottom)
  { index: 22, type: 'PROPERTY', key: 'PROP_FIN_3', name: 'Penthouse Hoàng Kim', group: 'FINANCE', groupName: 'Tài Chính', color: '#f59e0b', price: 380, rent: 85 },
  { index: 23, type: 'PROPERTY', key: 'PROP_CEN_1', name: 'Quảng Trường Trung Tâm', group: 'CENTRAL', groupName: 'Trung Tâm', color: '#8b5cf6', price: 400, rent: 90 },
  { index: 24, type: 'PROPERTY', key: 'PROP_CEN_2', name: 'Đại Lộ Ngôi Sao', group: 'CENTRAL', groupName: 'Trung Tâm', color: '#8b5cf6', price: 420, rent: 95 },
  { index: 25, type: 'EVENT', key: 'TILE_EVENT_4', name: 'Sự Kiện Đặc Biệt', label: 'CƠ HỘI', icon: 'Sparkles' },
  { index: 26, type: 'PROPERTY', key: 'PROP_CEN_3', name: 'Tập Đoàn Đa Quốc Gia', group: 'CENTRAL', groupName: 'Trung Tâm', color: '#8b5cf6', price: 450, rent: 110 },
  { index: 27, type: 'BONUS', key: 'TILE_BONUS_2', name: 'Thưởng Vượt Chỉ Số', label: 'THƯỞNG', bonus: 100, icon: 'Trophy' },
];

module.exports = {
  STARTING_CASH,
  START_PASS_BONUS,
  TURN_TIMEOUT_SECONDS,
  MAX_TURNS_LIMIT,
  CAREER_REWARDS,
  SEAT_COLORS,
  PREDEFINED_EVENTS,
  BOARD_TILES,
};

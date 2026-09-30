'use strict';

const dotenv = require('dotenv');
dotenv.config();

const { sequelize } = require('../src/models');
const bcrypt = require('bcryptjs');

async function resetAndSeedLocal() {
  console.log('🔄 Đang kết nối database để làm sạch dữ liệu...');
  await sequelize.authenticate();
  console.log('✅ Đã kết nối database.');

  // Đồng bộ lại tất cả bảng (Xóa cũ và tạo mới)
  console.log('🗑️  Đang xóa toàn bộ dữ liệu cũ và khởi tạo bảng mới...');
  await sequelize.sync({ force: true });
  console.log('✅ Đã tạo mới toàn bộ bảng thành công.');

  const now = new Date();
  const adminPasswordHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'Admin@123456', 12);
  const userPasswordHash = await bcrypt.hash('User@123456', 12);

  // 1. Tạo 4 Đội Nhóm (Teams)
  console.log('👥 Đang tạo 4 đội nhóm mẫu...');
  const teamsData = [
    { name: 'Team Sáng Tạo Alpha', description: 'Đội ngũ sáng tạo nội dung và sản xuất video' },
    { name: 'Team Kỹ Thuật Beta', description: 'Đội ngũ phát triển kỹ thuật và quản trị kênh' },
    { name: 'Team Truyền Thông Gamma', description: 'Đội ngũ phát triển cộng đồng và marketing' },
    { name: 'Team Sản Xuất Delta', description: 'Đội ngũ sản xuất và hậu kỳ video' },
  ];

  const createdTeams = await sequelize.models.Team.bulkCreate(teamsData);
  const alphaTeamId = createdTeams[0].id;
  const betaTeamId = createdTeams[1].id;

  // 2. Tạo 10 Tài khoản với 10 Chức vụ & 10 Phòng ban
  console.log('👤 Đang tạo 10 tài khoản mẫu theo yêu cầu...');
  const seedUsers = [
    {
      name: 'Duy Tiến (Admin)',
      email: process.env.SEED_ADMIN_EMAIL || 'admin@workrank.local',
      passwordHash: adminPasswordHash,
      role: 'admin',
      jobTitle: 'Giám đốc',
      department: 'Ban Giám Đốc',
      teamId: alphaTeamId,
      isVerified: true,
      isDev: true,
      status: 'active',
    },
    {
      name: 'Nguyễn Hoàng Nam',
      email: 'editor.nam@3winmedia.vn',
      passwordHash: userPasswordHash,
      role: 'user',
      jobTitle: 'Trưởng phòng',
      department: 'Phòng Sản Xuất Video',
      teamId: alphaTeamId,
      isVerified: true,
      isDev: false,
      status: 'active',
    },
    {
      name: 'Trần Thu Hà',
      email: 'creator.ha@3winmedia.vn',
      passwordHash: userPasswordHash,
      role: 'user',
      jobTitle: 'Content Creator',
      department: 'Media & Content',
      teamId: alphaTeamId,
      isVerified: true,
      isDev: false,
      status: 'active',
    },
    {
      name: 'Lê Quốc Bảo',
      email: 'dev.bao@3winmedia.vn',
      passwordHash: userPasswordHash,
      role: 'user',
      jobTitle: 'Kỹ sư hệ thống',
      department: 'Engineering Core',
      teamId: betaTeamId,
      isVerified: true,
      isDev: true,
      status: 'active',
    },
    {
      name: 'Phạm Minh Đức',
      email: 'manager.duc@3winmedia.vn',
      passwordHash: userPasswordHash,
      role: 'manager',
      jobTitle: 'Quản lý kênh',
      department: 'Phòng Truyền Thông',
      teamId: betaTeamId,
      isVerified: true,
      isDev: false,
      status: 'active',
    },
    {
      name: 'Vũ Mai Linh',
      email: 'marketing.linh@3winmedia.vn',
      passwordHash: userPasswordHash,
      role: 'user',
      jobTitle: 'Chuyên viên truyền thông',
      department: 'Community & Growth',
      teamId: null,
      isVerified: false,
      isDev: false,
      status: 'active',
    },
    {
      name: 'Đỗ Hải Đăng',
      email: 'design.dang@3winmedia.vn',
      passwordHash: userPasswordHash,
      role: 'user',
      jobTitle: 'Nhân viên',
      department: 'Phòng Kỹ Thuật',
      teamId: null,
      isVerified: false,
      isDev: false,
      status: 'active',
    },
    {
      name: 'Bùi Phương Thảo',
      email: 'script.thao@3winmedia.vn',
      passwordHash: userPasswordHash,
      role: 'user',
      jobTitle: 'Phó phòng',
      department: 'Phòng Biên Kịch & Ý Tưởng',
      teamId: null,
      isVerified: false,
      isDev: false,
      status: 'active',
    },
    {
      name: 'Hoàng Gia Huy',
      email: 'analyst.huy@3winmedia.vn',
      passwordHash: userPasswordHash,
      role: 'user',
      jobTitle: 'Phó giám đốc',
      department: 'Phòng Phân Tích Dữ Liệu',
      teamId: null,
      isVerified: true,
      isDev: false,
      status: 'active',
    },
    {
      name: 'Ngô Tuấn Kiệt',
      email: 'intern.kiet@3winmedia.vn',
      passwordHash: userPasswordHash,
      role: 'user',
      jobTitle: 'Editor',
      department: 'Phòng Hành Chính & Vận Hành',
      teamId: null,
      isVerified: false,
      isDev: false,
      status: 'active',
    },
  ];

  await sequelize.models.User.bulkCreate(seedUsers);
  console.log('✅ Đã tạo thành công 10 tài khoản mẫu!');
  console.log('\n=============================================');
  console.log('🎉 KHỞI TẠO DỮ LIỆU HOÀN TẤT!');
  console.log('🔑 Tài khoản Admin: admin@workrank.local / Admin@123456');
  console.log('🔑 9 Tài khoản nhân viên: password là User@123456');
  console.log('=============================================\n');

  process.exit(0);
}

resetAndSeedLocal().catch((err) => {
  console.error('❌ Lỗi khi khởi tạo database:', err);
  process.exit(1);
});

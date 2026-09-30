'use strict';

const bcrypt = require('bcryptjs');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const adminPasswordHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'Admin@123456', 12);
    const userPasswordHash = await bcrypt.hash('User@123456', 12);

    // 1. Tạo 4 Đội Nhóm (Teams)
    await queryInterface.bulkInsert('teams', [
      { name: 'Team Sáng Tạo Alpha', description: 'Đội ngũ sáng tạo nội dung và sản xuất video', created_at: now, updated_at: now },
      { name: 'Team Kỹ Thuật Beta', description: 'Đội ngũ phát triển kỹ thuật và quản trị kênh', created_at: now, updated_at: now },
      { name: 'Team Truyền Thông Gamma', description: 'Đội ngũ phát triển cộng đồng và marketing', created_at: now, updated_at: now },
      { name: 'Team Sản Xuất Delta', description: 'Đội ngũ sản xuất và hậu kỳ video', created_at: now, updated_at: now },
    ], { ignoreDuplicates: true });

    const [teams] = await queryInterface.sequelize.query("SELECT id, name FROM teams");
    const alphaTeam = teams.find(t => t.name === 'Team Sáng Tạo Alpha');
    const betaTeam = teams.find(t => t.name === 'Team Kỹ Thuật Beta');

    const alphaTeamId = alphaTeam?.id || null;
    const betaTeamId = betaTeam?.id || null;

    // 2. Tạo 10 Tài khoản với 10 Chức danh & 10 Bộ phận
    const seedUsers = [
      {
        name: 'Duy Tiến (Admin)',
        email: process.env.SEED_ADMIN_EMAIL || 'admin@workrank.local',
        password_hash: adminPasswordHash,
        role: 'admin',
        job_title: 'Giám đốc',
        department: 'Ban Giám Đốc',
        team_id: alphaTeamId,
        is_verified: true,
        is_dev: true,
        status: 'active',
        created_at: now,
        updated_at: now,
      },
      {
        name: 'Nguyễn Hoàng Nam',
        email: 'editor.nam@3winmedia.vn',
        password_hash: userPasswordHash,
        role: 'user',
        job_title: 'Trưởng phòng',
        department: 'Phòng Sản Xuất Video',
        team_id: alphaTeamId,
        is_verified: true,
        is_dev: false,
        status: 'active',
        created_at: now,
        updated_at: now,
      },
      {
        name: 'Trần Thu Hà',
        email: 'creator.ha@3winmedia.vn',
        password_hash: userPasswordHash,
        role: 'user',
        job_title: 'Content Creator',
        department: 'Media & Content',
        team_id: alphaTeamId,
        is_verified: true,
        is_dev: false,
        status: 'active',
        created_at: now,
        updated_at: now,
      },
      {
        name: 'Lê Quốc Bảo',
        email: 'dev.bao@3winmedia.vn',
        password_hash: userPasswordHash,
        role: 'user',
        job_title: 'Kỹ sư hệ thống',
        department: 'Engineering Core',
        team_id: betaTeamId,
        is_verified: true,
        is_dev: true,
        status: 'active',
        created_at: now,
        updated_at: now,
      },
      {
        name: 'Phạm Minh Đức',
        email: 'manager.duc@3winmedia.vn',
        password_hash: userPasswordHash,
        role: 'manager',
        job_title: 'Quản lý kênh',
        department: 'Phòng Truyền Thông',
        team_id: betaTeamId,
        is_verified: true,
        is_dev: false,
        status: 'active',
        created_at: now,
        updated_at: now,
      },
      {
        name: 'Vũ Mai Linh',
        email: 'marketing.linh@3winmedia.vn',
        password_hash: userPasswordHash,
        role: 'user',
        job_title: 'Chuyên viên truyền thông',
        department: 'Community & Growth',
        team_id: null, // Chưa vào team (để test mời vào nhóm)
        is_verified: false,
        is_dev: false,
        status: 'active',
        created_at: now,
        updated_at: now,
      },
      {
        name: 'Đỗ Hải Đăng',
        email: 'design.dang@3winmedia.vn',
        password_hash: userPasswordHash,
        role: 'user',
        job_title: 'Nhân viên',
        department: 'Phòng Kỹ Thuật',
        team_id: null,
        is_verified: false,
        is_dev: false,
        status: 'active',
        created_at: now,
        updated_at: now,
      },
      {
        name: 'Bùi Phương Thảo',
        email: 'script.thao@3winmedia.vn',
        password_hash: userPasswordHash,
        role: 'user',
        job_title: 'Phó phòng',
        department: 'Phòng Biên Kịch & Ý Tưởng',
        team_id: null,
        is_verified: false,
        is_dev: false,
        status: 'active',
        created_at: now,
        updated_at: now,
      },
      {
        name: 'Hoàng Gia Huy',
        email: 'analyst.huy@3winmedia.vn',
        password_hash: userPasswordHash,
        role: 'user',
        job_title: 'Phó giám đốc',
        department: 'Phòng Phân Tích Dữ Liệu',
        team_id: null,
        is_verified: true,
        is_dev: false,
        status: 'active',
        created_at: now,
        updated_at: now,
      },
      {
        name: 'Ngô Tuấn Kiệt',
        email: 'intern.kiet@3winmedia.vn',
        password_hash: userPasswordHash,
        role: 'user',
        job_title: 'Editor',
        department: 'Phòng Hành Chính & Vận Hành',
        team_id: null,
        is_verified: false,
        is_dev: false,
        status: 'active',
        created_at: now,
        updated_at: now,
      },
    ];

    await queryInterface.bulkInsert('users', seedUsers, { ignoreDuplicates: true });
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('users', null, {});
    await queryInterface.bulkDelete('teams', null, {});
  },
};

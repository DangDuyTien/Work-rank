'use strict';

const dotenv = require('dotenv');
dotenv.config();

const { sequelize, User } = require('../src/models');
const bcrypt = require('bcryptjs');

async function resetAndCleanLocal() {
  console.log('🔄 Đang kết nối database...');
  await sequelize.authenticate();
  console.log('✅ Đã kết nối database.');

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (adminEmail && adminPassword) {
    console.log(`👤 Đang khởi tạo tài khoản quản trị viên: ${adminEmail}`);
    const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
    await User.findOrCreate({
      where: { email: adminEmail },
      defaults: {
        name: process.env.SEED_ADMIN_NAME || 'System Admin',
        email: adminEmail,
        passwordHash: adminPasswordHash,
        role: 'admin',
        jobTitle: 'System Administrator',
        department: 'Management',
        isVerified: true,
        isDev: false,
        status: 'active',
      },
    });
    console.log('✅ Đã tạo tài khoản quản trị thành công.');
  }

  console.log('🎉 Hoàn tất! Không tạo dữ liệu ảo (demo/fake data).');
  await sequelize.close();
}

resetAndCleanLocal().catch((err) => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});

'use strict';

const bcrypt = require('bcryptjs');

module.exports = {
  async up(queryInterface) {
    const adminEmail = process.env.SEED_ADMIN_EMAIL;
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;

    // Only create an initial admin if explicitly configured via environment variables
    if (!adminEmail || !adminPassword) {
      return;
    }

    const [existingUsers] = await queryInterface.sequelize.query(
      'SELECT id FROM users WHERE email = :email LIMIT 1',
      { replacements: { email: adminEmail } }
    );

    if (existingUsers && existingUsers.length > 0) {
      return;
    }

    const now = new Date();
    const adminPasswordHash = await bcrypt.hash(adminPassword, 12);

    await queryInterface.bulkInsert('users', [
      {
        name: process.env.SEED_ADMIN_NAME || 'System Admin',
        email: adminEmail,
        password_hash: adminPasswordHash,
        role: 'admin',
        job_title: 'System Administrator',
        department: 'Management',
        team_id: null,
        is_verified: true,
        is_dev: false,
        status: 'active',
        created_at: now,
        updated_at: now,
      },
    ], { ignoreDuplicates: true });
  },

  async down(queryInterface) {
    const adminEmail = process.env.SEED_ADMIN_EMAIL;
    if (adminEmail) {
      await queryInterface.bulkDelete('users', { email: adminEmail }, {});
    }
  },
};

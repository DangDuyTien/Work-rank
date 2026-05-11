'use strict';

const bcrypt = require('bcryptjs');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const passwordHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'Admin@123456', 12);

    await queryInterface.bulkInsert('teams', [
      { name: 'Default Team', description: 'Initial WorkRank team', created_at: now, updated_at: now },
    ], { ignoreDuplicates: true });

    const [teams] = await queryInterface.sequelize.query("SELECT id FROM teams WHERE name = 'Default Team' LIMIT 1");
    const teamId = teams[0]?.id || null;

    await queryInterface.bulkInsert('users', [
      {
        name: process.env.SEED_ADMIN_NAME || 'WorkRank Admin',
        email: process.env.SEED_ADMIN_EMAIL || 'admin@workrank.local',
        password_hash: passwordHash,
        role: 'admin',
        team_id: teamId,
        status: 'active',
        created_at: now,
        updated_at: now,
      },
    ], { ignoreDuplicates: true });
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('users', { email: process.env.SEED_ADMIN_EMAIL || 'admin@workrank.local' });
    await queryInterface.bulkDelete('teams', { name: 'Default Team' });
  },
};

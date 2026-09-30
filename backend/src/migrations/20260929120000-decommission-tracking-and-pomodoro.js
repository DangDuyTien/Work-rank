'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Drop tables in dependency order
    const tablesToDrop = [
      'activity_events',
      'user_minute_stats',
      'work_sessions',
      'daily_stats',
      'devices',
      'simulation_settings',
    ];

    for (const tableName of tablesToDrop) {
      const exists = await queryInterface.tableExists(tableName);
      if (exists) {
        await queryInterface.dropTable(tableName);
      }
    }
  },

  async down() {
    // Irreversible decommissioning of tracking & pomodoro tables
  },
};

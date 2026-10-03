'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Drop computer_activity_events if exists
    const hasComputerEvents = await queryInterface.describeTable('computer_activity_events').then(() => true).catch(() => false);
    if (hasComputerEvents) {
      await queryInterface.dropTable('computer_activity_events');
    }

    // 2. Drop computer_daily_stats if exists
    const hasComputerDaily = await queryInterface.describeTable('computer_daily_stats').then(() => true).catch(() => false);
    if (hasComputerDaily) {
      await queryInterface.dropTable('computer_daily_stats');
    }

    // 3. Drop activity_events if exists
    const hasActivityEvents = await queryInterface.describeTable('activity_events').then(() => true).catch(() => false);
    if (hasActivityEvents) {
      await queryInterface.dropTable('activity_events');
    }

    // 4. Remove 'activity_tracking' setting from system_settings if exists
    const hasSystemSettings = await queryInterface.describeTable('system_settings').then(() => true).catch(() => false);
    if (hasSystemSettings) {
      await queryInterface.bulkDelete('system_settings', {
        setting_key: 'activity_tracking',
      }).catch(() => {});
    }
  },

  async down(queryInterface, Sequelize) {
    // Irreversible decommissioning of activity tracker
  },
};

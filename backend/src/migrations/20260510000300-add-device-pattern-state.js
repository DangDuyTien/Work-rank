'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('devices', 'last_event_at', { type: Sequelize.DATE, allowNull: true, after: 'last_sequence' });
    await queryInterface.addColumn('devices', 'last_click_count', { type: Sequelize.INTEGER.UNSIGNED, allowNull: true, after: 'last_event_at' });
    await queryInterface.addColumn('devices', 'last_active_seconds', { type: Sequelize.INTEGER.UNSIGNED, allowNull: true, after: 'last_click_count' });
    await queryInterface.addColumn('devices', 'repeated_click_pattern_count', { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, after: 'last_active_seconds' });
    await queryInterface.addColumn('devices', 'click_only_streak_count', { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, after: 'repeated_click_pattern_count' });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('devices', 'click_only_streak_count');
    await queryInterface.removeColumn('devices', 'repeated_click_pattern_count');
    await queryInterface.removeColumn('devices', 'last_active_seconds');
    await queryInterface.removeColumn('devices', 'last_click_count');
    await queryInterface.removeColumn('devices', 'last_event_at');
  },
};

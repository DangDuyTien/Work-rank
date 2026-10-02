'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. computer_activity_events table
    const eventsTableExists = await queryInterface.describeTable('computer_activity_events').then(() => true).catch(() => false);
    if (!eventsTableExists) {
      await queryInterface.createTable('computer_activity_events', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
        },
        session_id: { type: Sequelize.STRING(128), allowNull: true },
        state: {
          type: Sequelize.ENUM('ACTIVE', 'IDLE'),
          allowNull: false,
          defaultValue: 'ACTIVE',
        },
        active_app: { type: Sequelize.STRING(128), allowNull: true },
        app_category: { type: Sequelize.STRING(64), allowNull: true, defaultValue: 'OTHER' },
        context: { type: Sequelize.STRING(64), allowNull: true, defaultValue: 'COMPUTER' },
        active_seconds: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        idle_seconds: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        mouse_clicks: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        keyboard_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        occurred_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        device_platform: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'macos' },
        metadata: { type: Sequelize.JSON, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });

      await queryInterface.addIndex('computer_activity_events', ['user_id', 'occurred_at'], { name: 'idx_cmp_act_user_date' });
      await queryInterface.addIndex('computer_activity_events', ['occurred_at'], { name: 'idx_cmp_act_occurred' });
      await queryInterface.addIndex('computer_activity_events', ['state'], { name: 'idx_cmp_act_state' });
    }

    // 2. computer_daily_stats table (Aggregated per user per day for Độ Năng Động)
    const statsTableExists = await queryInterface.describeTable('computer_daily_stats').then(() => true).catch(() => false);
    if (!statsTableExists) {
      await queryInterface.createTable('computer_daily_stats', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
        },
        stat_date: { type: Sequelize.DATEONLY, allowNull: false },
        active_seconds: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        idle_seconds: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        mouse_clicks: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        keyboard_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        activity_score: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        focus_score: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        active_apps_breakdown: { type: Sequelize.JSON, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });

      await queryInterface.addIndex('computer_daily_stats', ['user_id', 'stat_date'], {
        unique: true,
        name: 'idx_cmp_daily_user_date_unique',
      });
      await queryInterface.addIndex('computer_daily_stats', ['stat_date', 'activity_score'], {
        name: 'idx_cmp_daily_date_score',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('computer_daily_stats').catch(() => {});
    await queryInterface.dropTable('computer_activity_events').catch(() => {});
  },
};

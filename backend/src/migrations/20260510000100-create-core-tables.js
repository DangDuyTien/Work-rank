'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('teams', {
      id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      name: { type: Sequelize.STRING(120), allowNull: false, unique: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('users', {
      id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      name: { type: Sequelize.STRING(120), allowNull: false },
      email: { type: Sequelize.STRING(191), allowNull: false, unique: true },
      password_hash: { type: Sequelize.STRING(191), allowNull: false },
      refresh_token_hash: { type: Sequelize.STRING(191), allowNull: true },
      role: { type: Sequelize.ENUM('admin', 'manager', 'user'), allowNull: false, defaultValue: 'user' },
      team_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: true, references: { model: 'teams', key: 'id' }, onDelete: 'SET NULL' },
      status: { type: Sequelize.ENUM('active', 'inactive'), allowNull: false, defaultValue: 'active' },
      last_seen_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('devices', {
      id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      user_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      device_uuid: { type: Sequelize.STRING(191), allowNull: false },
      device_name: { type: Sequelize.STRING(191), allowNull: false },
      platform: { type: Sequelize.ENUM('macos', 'windows', 'linux'), allowNull: false },
      app_version: { type: Sequelize.STRING(50), allowNull: true },
      last_sync_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('devices', ['user_id', 'device_uuid'], { unique: true });

    await queryInterface.createTable('work_sessions', {
      id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      user_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      device_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, references: { model: 'devices', key: 'id' }, onDelete: 'CASCADE' },
      started_at: { type: Sequelize.DATE, allowNull: false },
      ended_at: { type: Sequelize.DATE, allowNull: true },
      duration_seconds: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      active_seconds: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      idle_seconds: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      keystroke_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      mouse_click_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      mouse_move_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      status: { type: Sequelize.ENUM('running', 'ended', 'crashed'), allowNull: false, defaultValue: 'running' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('activity_events', {
      id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      user_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      device_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, references: { model: 'devices', key: 'id' }, onDelete: 'CASCADE' },
      session_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: true, references: { model: 'work_sessions', key: 'id' }, onDelete: 'SET NULL' },
      event_time: { type: Sequelize.DATE, allowNull: false },
      active_seconds: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      idle_seconds: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      keystroke_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      mouse_click_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      mouse_move_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      metadata_json: { type: Sequelize.JSON, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('activity_events', ['user_id', 'event_time']);

    await queryInterface.createTable('daily_stats', {
      id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      user_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      stat_date: { type: Sequelize.DATEONLY, allowNull: false },
      total_seconds: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      active_seconds: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      idle_seconds: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      focus_score: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      keystroke_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      mouse_click_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      session_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      rank_position: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('daily_stats', ['user_id', 'stat_date'], { unique: true });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('daily_stats');
    await queryInterface.dropTable('activity_events');
    await queryInterface.dropTable('work_sessions');
    await queryInterface.dropTable('devices');
    await queryInterface.dropTable('users');
    await queryInterface.dropTable('teams');
  },
};

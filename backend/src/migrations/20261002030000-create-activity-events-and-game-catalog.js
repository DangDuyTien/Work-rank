'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. activity_events (Pure telemetry, no anti-cheat, no suspicion fields)
    const activityExists = await queryInterface.describeTable('activity_events').then(() => true).catch(() => false);
    if (!activityExists) {
      await queryInterface.createTable('activity_events', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },
        session_id: { type: Sequelize.STRING(128), allowNull: true },
        event_type: {
          type: Sequelize.ENUM('CLICK', 'KEYBOARD_ACTIVITY'),
          allowNull: false,
        },
        route: { type: Sequelize.STRING(255), allowNull: true },
        occurred_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        received_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        metadata: { type: Sequelize.JSON, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });

      await queryInterface.addIndex('activity_events', ['occurred_at'], { name: 'idx_activity_events_occurred_at' });
      await queryInterface.addIndex('activity_events', ['user_id', 'occurred_at'], { name: 'idx_activity_events_user_occurred' });
      await queryInterface.addIndex('activity_events', ['event_type', 'occurred_at'], { name: 'idx_activity_events_type_occurred' });
    }

    // 2. system_settings (System-wide configuration, including activity tracking toggles)
    const settingsExists = await queryInterface.describeTable('system_settings').then(() => true).catch(() => false);
    if (!settingsExists) {
      await queryInterface.createTable('system_settings', {
        id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        setting_key: { type: Sequelize.STRING(128), allowNull: false, unique: true },
        setting_value: { type: Sequelize.JSON, allowNull: false },
        description: { type: Sequelize.STRING(255), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });

      // Default setting for activity tracking
      await queryInterface.bulkInsert('system_settings', [
        {
          setting_key: 'activity_tracking',
          setting_value: JSON.stringify({
            mouse_tracking_enabled: true,
            keyboard_tracking_enabled: true,
          }),
          description: 'Cấu hình bật/tắt ghi nhận telemetry Activity Tracking (Chuột & Bàn phím)',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);
    }

    // 3. game_catalogs (Global Game Status Catalog: AVAILABLE vs COMING_SOON)
    const gamesExists = await queryInterface.describeTable('game_catalogs').then(() => true).catch(() => false);
    if (!gamesExists) {
      await queryInterface.createTable('game_catalogs', {
        id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        game_key: { type: Sequelize.STRING(64), allowNull: false, unique: true },
        name: { type: Sequelize.STRING(128), allowNull: false },
        status: {
          type: Sequelize.ENUM('AVAILABLE', 'COMING_SOON'),
          allowNull: false,
          defaultValue: 'AVAILABLE',
        },
        enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        description: { type: Sequelize.TEXT, allowNull: true },
        icon: { type: Sequelize.STRING(64), allowNull: true },
        route: { type: Sequelize.STRING(255), allowNull: false },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });

      await queryInterface.addIndex('game_catalogs', ['status'], { name: 'idx_game_catalogs_status' });
      await queryInterface.addIndex('game_catalogs', ['sort_order'], { name: 'idx_game_catalogs_sort' });

      // Seed standard games
      await queryInterface.bulkInsert('game_catalogs', [
        {
          game_key: 'capital_board',
          name: 'Cờ Tỷ Phú',
          status: 'AVAILABLE',
          enabled: true,
          sort_order: 1,
          description: 'Trò chơi bàn cờ tỷ phú kinh doanh và đầu tư bất động sản thời gian thực.',
          icon: 'Gamepad2',
          route: '/games/capital-board',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          game_key: 'game_2048',
          name: '2048',
          status: 'AVAILABLE',
          enabled: true,
          sort_order: 2,
          description: 'Trò chơi ghép số 2048 trí tuệ, thử thách kỹ năng tư duy và bảng xếp hạng công ty.',
          icon: 'LayoutGrid',
          route: '/games/2048',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          game_key: 'sam',
          name: 'Đánh Sâm',
          status: 'AVAILABLE',
          enabled: true,
          sort_order: 3,
          description: 'Trò chơi bài dân gian Đánh Sâm 2–4 người thời gian thực kịch tính.',
          icon: 'Club',
          route: '/games/sam',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          game_key: 'quiz',
          name: 'Đoán Hình & Đoán Nhạc',
          status: 'AVAILABLE',
          enabled: true,
          sort_order: 4,
          description: 'Mini game đoán hình ảnh & đoán bài hát tốc độ cao nhiều người chơi.',
          icon: 'Sparkles',
          route: '/games/quiz',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('activity_events').catch(() => {});
    await queryInterface.dropTable('system_settings').catch(() => {});
    await queryInterface.dropTable('game_catalogs').catch(() => {});
  },
};

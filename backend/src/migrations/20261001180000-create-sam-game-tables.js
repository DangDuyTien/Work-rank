'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. sam_rooms
    const roomsExists = await queryInterface.describeTable('sam_rooms').then(() => true).catch(() => false);
    if (!roomsExists) {
      await queryInterface.createTable('sam_rooms', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        code: { type: Sequelize.STRING(20), allowNull: false, unique: true },
        title: { type: Sequelize.STRING(120), allowNull: false, defaultValue: 'Phòng Đánh Sâm' },
        host_user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
        },
        status: {
          type: Sequelize.ENUM('WAITING', 'PLAYING', 'FINISHED', 'ABANDONED'),
          allowNull: false,
          defaultValue: 'WAITING',
        },
        max_players: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 4 },
        current_turn_user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },
        current_turn_seat: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
        turn_deadline: { type: Sequelize.DATE, allowNull: true },
        turn_duration_seconds: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 25 },
        round_number: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
        last_played_cards: { type: Sequelize.JSON, allowNull: true },
        last_play_user_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: true },
        pass_player_ids: { type: Sequelize.JSON, allowNull: true },
        sam_declarer_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: true },
        sam_phase: {
          type: Sequelize.ENUM('WAITING', 'SAM_DECLARING', 'PLAYING', 'FINISHED'),
          allowNull: false,
          defaultValue: 'WAITING',
        },
        winner_user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },
        started_at: { type: Sequelize.DATE, allowNull: true },
        finished_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      });

      await queryInterface.addIndex('sam_rooms', ['status'], { name: 'idx_sam_rooms_status' });
      await queryInterface.addIndex('sam_rooms', ['code'], { name: 'idx_sam_rooms_code' });
      await queryInterface.addIndex('sam_rooms', ['host_user_id'], { name: 'idx_sam_rooms_host' });
    }

    // 2. sam_players
    const playersExists = await queryInterface.describeTable('sam_players').then(() => true).catch(() => false);
    if (!playersExists) {
      await queryInterface.createTable('sam_players', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        room_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'sam_rooms', key: 'id' },
          onDelete: 'CASCADE',
        },
        user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
        },
        seat_index: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
        hand_cards: { type: Sequelize.JSON, allowNull: false },
        remaining_cards_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 10 },
        status: {
          type: Sequelize.ENUM('WAITING', 'ACTIVE', 'FINISHED', 'SURRENDERED', 'DISCONNECTED'),
          allowNull: false,
          defaultValue: 'WAITING',
        },
        has_declared_sam: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        is_bao_mot: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        score_delta: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        rank: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
        joined_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      });

      await queryInterface.addIndex('sam_players', ['room_id', 'user_id'], {
        unique: true,
        name: 'idx_sam_players_room_user_unique',
      });
      await queryInterface.addIndex('sam_players', ['room_id', 'seat_index'], {
        unique: true,
        name: 'idx_sam_players_room_seat_unique',
      });
    }

    // 3. sam_actions
    const actionsExists = await queryInterface.describeTable('sam_actions').then(() => true).catch(() => false);
    if (!actionsExists) {
      await queryInterface.createTable('sam_actions', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        room_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'sam_rooms', key: 'id' },
          onDelete: 'CASCADE',
        },
        user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
        },
        action_type: {
          type: Sequelize.ENUM('DEAL', 'DECLARE_SAM', 'SKIP_SAM', 'PLAY', 'PASS', 'CHOP', 'TIMEOUT', 'FINISH'),
          allowNull: false,
        },
        cards: { type: Sequelize.JSON, allowNull: true },
        combo_type: { type: Sequelize.STRING(32), allowNull: true },
        metadata: { type: Sequelize.JSON, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });

      await queryInterface.addIndex('sam_actions', ['room_id', 'created_at'], { name: 'idx_sam_actions_room_time' });
    }

    // 4. sam_results
    const resultsExists = await queryInterface.describeTable('sam_results').then(() => true).catch(() => false);
    if (!resultsExists) {
      await queryInterface.createTable('sam_results', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        room_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'sam_rooms', key: 'id' },
          onDelete: 'CASCADE',
        },
        winner_user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
        },
        details: { type: Sequelize.JSON, allowNull: false },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });

      await queryInterface.addIndex('sam_results', ['room_id'], { name: 'idx_sam_results_room_id' });
    }

    // 5. sam_user_stats
    const statsExists = await queryInterface.describeTable('sam_user_stats').then(() => true).catch(() => false);
    if (!statsExists) {
      await queryInterface.createTable('sam_user_stats', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          unique: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
        },
        games_played: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        games_won: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        sam_declared: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        sam_won: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        total_points: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        win_streak: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        max_win_streak: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      });

      await queryInterface.addIndex('sam_user_stats', ['user_id'], { unique: true, name: 'idx_sam_user_stats_user_unique' });
      await queryInterface.addIndex('sam_user_stats', ['total_points'], { name: 'idx_sam_user_stats_points' });
      await queryInterface.addIndex('sam_user_stats', ['games_won'], { name: 'idx_sam_user_stats_wins' });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('sam_actions').catch(() => {});
    await queryInterface.dropTable('sam_results').catch(() => {});
    await queryInterface.dropTable('sam_players').catch(() => {});
    await queryInterface.dropTable('sam_user_stats').catch(() => {});
    await queryInterface.dropTable('sam_rooms').catch(() => {});
  },
};

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. typing_challenges
    const challengesExists = await queryInterface.describeTable('typing_challenges').then(() => true).catch(() => false);
    if (!challengesExists) {
      await queryInterface.createTable('typing_challenges', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        title: { type: Sequelize.STRING(150), allowNull: false },
        content: { type: Sequelize.TEXT, allowNull: false },
        language: {
          type: Sequelize.ENUM('VI', 'EN', 'CODE'),
          allowNull: false,
          defaultValue: 'VI',
        },
        category: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'workrank_culture',
        },
        difficulty: {
          type: Sequelize.ENUM('EASY', 'MEDIUM', 'HARD', 'EXPERT'),
          allowNull: false,
          defaultValue: 'MEDIUM',
        },
        word_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        character_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_by: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      });

      await queryInterface.addIndex('typing_challenges', ['language', 'is_active'], { name: 'idx_typing_ch_lang_active' });
    }

    // 2. typing_rooms
    const roomsExists = await queryInterface.describeTable('typing_rooms').then(() => true).catch(() => false);
    if (!roomsExists) {
      await queryInterface.createTable('typing_rooms', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        code: { type: Sequelize.STRING(20), allowNull: false, unique: true },
        title: { type: Sequelize.STRING(150), allowNull: false },
        host_user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
        },
        mode: {
          type: Sequelize.ENUM('SOLO', '1V1', '2V2', '3V3'),
          allowNull: false,
          defaultValue: '1V1',
        },
        match_type: {
          type: Sequelize.ENUM('PRACTICE', 'RANKED', 'TOURNAMENT'),
          allowNull: false,
          defaultValue: 'RANKED',
        },
        status: {
          type: Sequelize.ENUM('WAITING', 'STARTING', 'PLAYING', 'FINISHED', 'ABANDONED'),
          allowNull: false,
          defaultValue: 'WAITING',
        },
        max_players: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 2 },
        challenge_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: { model: 'typing_challenges', key: 'id' },
          onDelete: 'SET NULL',
        },
        target_word_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
        challenge_text: { type: Sequelize.TEXT, allowNull: true },
        difficulty: {
          type: Sequelize.ENUM('EASY', 'MEDIUM', 'HARD', 'EXPERT'),
          allowNull: false,
          defaultValue: 'MEDIUM',
        },
        start_at: { type: Sequelize.DATE, allowNull: true },
        started_at: { type: Sequelize.DATE, allowNull: true },
        finished_at: { type: Sequelize.DATE, allowNull: true },
        duration_limit_seconds: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 120 },
        winner_team: {
          type: Sequelize.ENUM('A', 'B', 'DRAW', 'NONE'),
          allowNull: false,
          defaultValue: 'NONE',
        },
        winner_user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },
        is_test: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      });

      await queryInterface.addIndex('typing_rooms', ['status'], { name: 'idx_typing_rooms_status' });
      await queryInterface.addIndex('typing_rooms', ['code'], { name: 'idx_typing_rooms_code' });
      await queryInterface.addIndex('typing_rooms', ['host_user_id'], { name: 'idx_typing_rooms_host' });
    }

    // 3. typing_players
    const playersExists = await queryInterface.describeTable('typing_players').then(() => true).catch(() => false);
    if (!playersExists) {
      await queryInterface.createTable('typing_players', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        room_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'typing_rooms', key: 'id' },
          onDelete: 'CASCADE',
        },
        user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
        },
        team: {
          type: Sequelize.ENUM('A', 'B', 'NONE'),
          allowNull: false,
          defaultValue: 'NONE',
        },
        seat_index: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        is_ready: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        status: {
          type: Sequelize.ENUM('WAITING', 'TYPING', 'FINISHED', 'DISCONNECTED', 'SURRENDERED'),
          allowNull: false,
          defaultValue: 'WAITING',
        },
        progress_pct: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
        typed_chars: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        wpm: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
        accuracy: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 100.0 },
        error_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        completion_time_ms: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
        individual_rank: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
        score_delta: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        performance_score: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
        is_bot: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        bot_name: { type: Sequelize.STRING(64), allowNull: true },
        bot_target_wpm: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
        final_payload: { type: Sequelize.JSON, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      });

      await queryInterface.addIndex('typing_players', ['room_id', 'user_id'], { name: 'idx_typing_players_room_user' });
    }

    // 4. typing_match_results
    const resultsExists = await queryInterface.describeTable('typing_match_results').then(() => true).catch(() => false);
    if (!resultsExists) {
      await queryInterface.createTable('typing_match_results', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        room_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'typing_rooms', key: 'id' },
          onDelete: 'CASCADE',
        },
        mode: {
          type: Sequelize.ENUM('SOLO', '1V1', '2V2', '3V3'),
          allowNull: false,
          defaultValue: '1V1',
        },
        match_type: {
          type: Sequelize.ENUM('PRACTICE', 'RANKED', 'TOURNAMENT'),
          allowNull: false,
          defaultValue: 'RANKED',
        },
        season_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: { model: 'seasons', key: 'id' },
          onDelete: 'SET NULL',
        },
        winner_user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },
        winner_team: {
          type: Sequelize.ENUM('A', 'B', 'DRAW', 'NONE'),
          allowNull: false,
          defaultValue: 'NONE',
        },
        team_a_score: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
        team_b_score: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
        results: { type: Sequelize.JSON, allowNull: false },
        played_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      });

      await queryInterface.addIndex('typing_match_results', ['room_id'], { name: 'idx_typing_results_room' });
    }

    // 5. typing_user_stats
    const statsExists = await queryInterface.describeTable('typing_user_stats').then(() => true).catch(() => false);
    if (!statsExists) {
      await queryInterface.createTable('typing_user_stats', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          unique: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
        },
        total_matches: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        ranked_matches: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        practice_matches: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        wins_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        team_wins_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        best_wpm: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
        avg_wpm: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
        best_accuracy: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
        avg_accuracy: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
        total_chars_typed: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
        total_errors: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
        perfect_runs_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        current_win_streak: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        max_win_streak: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        total_workrank_points_earned: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
        daily_ranked_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        daily_points_earned: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        daily_reset_date: { type: Sequelize.STRING(10), allowNull: true },
        last_played_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      });

      await queryInterface.addIndex('typing_user_stats', ['user_id'], { name: 'idx_typing_stats_user_id' });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('typing_match_results').catch(() => {});
    await queryInterface.dropTable('typing_players').catch(() => {});
    await queryInterface.dropTable('typing_rooms').catch(() => {});
    await queryInterface.dropTable('typing_challenges').catch(() => {});
    await queryInterface.dropTable('typing_user_stats').catch(() => {});
  },
};

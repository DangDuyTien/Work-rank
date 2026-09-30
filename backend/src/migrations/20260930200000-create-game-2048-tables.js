'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. game_2048_scores (Per-game completed sessions)
    const scoresExists = await queryInterface.describeTable('game_2048_scores').then(() => true).catch(() => false);
    if (!scoresExists) {
      await queryInterface.createTable('game_2048_scores', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
        },
        score: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        max_tile: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 2 },
        moves: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        game_session_id: { type: Sequelize.STRING(64), allowNull: false, unique: true },
        played_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });
      await queryInterface.addIndex('game_2048_scores', ['user_id'], { name: 'idx_game_2048_scores_user' });
      await queryInterface.addIndex('game_2048_scores', ['score'], { name: 'idx_game_2048_scores_score' });
      await queryInterface.addIndex('game_2048_scores', ['game_session_id'], { name: 'idx_game_2048_scores_session', unique: true });
    }

    // 2. game_2048_user_stats (Aggregated career best scores for company leaderboard)
    const statsExists = await queryInterface.describeTable('game_2048_user_stats').then(() => true).catch(() => false);
    if (!statsExists) {
      await queryInterface.createTable('game_2048_user_stats', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          unique: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
        },
        best_score: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        highest_tile: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 2 },
        total_games: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        total_moves: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
        first_achieved_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });
      await queryInterface.addIndex('game_2048_user_stats', ['best_score', 'first_achieved_at'], {
        name: 'idx_game_2048_user_stats_best_tiebreak',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('game_2048_scores').catch(() => {});
    await queryInterface.dropTable('game_2048_user_stats').catch(() => {});
  },
};

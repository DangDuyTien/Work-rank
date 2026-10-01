'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('game_2048_scores').catch(() => ({}));

    if (!tableInfo.status) {
      await queryInterface.addColumn('game_2048_scores', 'status', {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'ACTIVE',
      });
    }

    if (!tableInfo.board_state) {
      await queryInterface.addColumn('game_2048_scores', 'board_state', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!tableInfo.started_at) {
      await queryInterface.addColumn('game_2048_scores', 'started_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      });
    }

    if (!tableInfo.last_activity_at) {
      await queryInterface.addColumn('game_2048_scores', 'last_activity_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      });
    }

    if (!tableInfo.ended_at) {
      await queryInterface.addColumn('game_2048_scores', 'ended_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    // Add indexes for active sessions query
    try {
      await queryInterface.addIndex('game_2048_scores', ['user_id', 'status'], {
        name: 'idx_game_2048_scores_user_status',
      });
    } catch (e) {
      // index might already exist
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('game_2048_scores', 'status').catch(() => {});
    await queryInterface.removeColumn('game_2048_scores', 'board_state').catch(() => {});
    await queryInterface.removeColumn('game_2048_scores', 'started_at').catch(() => {});
    await queryInterface.removeColumn('game_2048_scores', 'last_activity_at').catch(() => {});
    await queryInterface.removeColumn('game_2048_scores', 'ended_at').catch(() => {});
  },
};

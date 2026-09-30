'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create season_individual_leaderboard_projections
    await queryInterface.createTable('season_individual_leaderboard_projections', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      season_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
      },
      team_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      rank: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
      },
      points: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      events_count: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      trend: {
        type: Sequelize.ENUM('UP', 'DOWN', 'SAME'),
        allowNull: false,
        defaultValue: 'SAME',
      },
      last_scored_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      user_name: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      user_avatar: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      team_name: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      team_color: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: '#0284c7',
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('season_individual_leaderboard_projections', ['season_id', 'user_id'], {
      unique: true,
      name: 'uniq_season_user_projection',
    });
    await queryInterface.addIndex('season_individual_leaderboard_projections', ['season_id', 'rank'], {
      name: 'idx_season_indiv_rank',
    });
    await queryInterface.addIndex('season_individual_leaderboard_projections', ['season_id', 'points'], {
      name: 'idx_season_indiv_points',
    });
    await queryInterface.addIndex('season_individual_leaderboard_projections', ['team_id', 'points'], {
      name: 'idx_season_indiv_team_points',
    });

    // 2. Create grand_individual_leaderboard_projections
    await queryInterface.createTable('grand_individual_leaderboard_projections', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      grand_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
      },
      team_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      rank: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
      },
      grand_points: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      season_wins: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      podium_count: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      events_count: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      trend: {
        type: Sequelize.ENUM('UP', 'DOWN', 'SAME'),
        allowNull: false,
        defaultValue: 'SAME',
      },
      last_scored_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      user_name: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      user_avatar: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      team_name: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      team_color: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: '#0284c7',
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('grand_individual_leaderboard_projections', ['grand_id', 'user_id'], {
      unique: true,
      name: 'uniq_grand_user_projection',
    });
    await queryInterface.addIndex('grand_individual_leaderboard_projections', ['grand_id', 'rank'], {
      name: 'idx_grand_indiv_rank',
    });
    await queryInterface.addIndex('grand_individual_leaderboard_projections', ['grand_id', 'grand_points'], {
      name: 'idx_grand_indiv_points',
    });
    await queryInterface.addIndex('grand_individual_leaderboard_projections', ['team_id', 'grand_points'], {
      name: 'idx_grand_indiv_team_points',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('grand_individual_leaderboard_projections');
    await queryInterface.dropTable('season_individual_leaderboard_projections');
  },
};

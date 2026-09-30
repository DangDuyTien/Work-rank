'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. COMPETITION USER SUMMARIES
    await queryInterface.createTable('competition_user_summaries', {
      user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        allowNull: false,
      },
      current_season_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      current_season_rank: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      current_season_score: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      grand_championship_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      grand_rank: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
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
      current_streak: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      weekly_progress: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      recent_score_delta: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      last_activity_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('competition_user_summaries', ['current_season_id'], {
      name: 'idx_user_summary_season',
    });
    await queryInterface.addIndex('competition_user_summaries', ['grand_championship_id'], {
      name: 'idx_user_summary_grand',
    });

    // 2. COMPETITION TEAM SUMMARIES
    await queryInterface.createTable('competition_team_summaries', {
      team_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        allowNull: false,
      },
      team_name: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      team_avatar: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      team_color: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: '#0284c7',
      },
      current_season_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      current_season_rank: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      current_season_score: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      grand_championship_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      grand_rank: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
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
      members_count: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      last_activity_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('competition_team_summaries', ['current_season_id'], {
      name: 'idx_team_summary_season',
    });
    await queryInterface.addIndex('competition_team_summaries', ['grand_championship_id'], {
      name: 'idx_team_summary_grand',
    });

    // 3. SEASON LEADERBOARD PROJECTIONS
    await queryInterface.createTable('season_leaderboard_projections', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      season_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
      },
      team_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
      },
      rank: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
      },
      score: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      wins: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      podiums: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      trend: {
        type: Sequelize.ENUM('UP', 'DOWN', 'SAME'),
        allowNull: false,
        defaultValue: 'SAME',
      },
      is_eligible: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      team_name: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      team_avatar: {
        type: Sequelize.STRING(255),
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
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('season_leaderboard_projections', ['season_id', 'team_id'], {
      name: 'uniq_season_team_projection',
      unique: true,
    });
    await queryInterface.addIndex('season_leaderboard_projections', ['season_id', 'rank'], {
      name: 'idx_season_proj_rank',
    });

    // 4. GRAND LEADERBOARD PROJECTIONS
    await queryInterface.createTable('grand_leaderboard_projections', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      grand_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
      },
      team_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
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
      completed_seasons: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      trend: {
        type: Sequelize.ENUM('UP', 'DOWN', 'SAME'),
        allowNull: false,
        defaultValue: 'SAME',
      },
      team_name: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('grand_leaderboard_projections', ['grand_id', 'team_id'], {
      name: 'uniq_grand_team_projection',
      unique: true,
    });
    await queryInterface.addIndex('grand_leaderboard_projections', ['grand_id', 'rank'], {
      name: 'idx_grand_proj_rank',
    });

    // 5. COMPETITION ACTIVITY PROJECTIONS
    await queryInterface.createTable('competition_activity_projections', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      activity_key: {
        type: Sequelize.STRING(191),
        allowNull: false,
        unique: true,
      },
      activity_type: {
        type: Sequelize.ENUM(
          'SCORE_AWARDED',
          'STREAK_ACHIEVED',
          'SEASON_WON',
          'PODIUM_REACHED',
          'GRAND_POINTS_EARNED',
          'CHALLENGE_COMPLETED',
          'RECONCILIATION'
        ),
        allowNull: false,
      },
      actor_user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      team_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      season_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      grand_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      occurred_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('competition_activity_projections', ['occurred_at'], {
      name: 'idx_activity_occurred_at',
    });
    await queryInterface.addIndex('competition_activity_projections', ['actor_user_id'], {
      name: 'idx_activity_user',
    });
    await queryInterface.addIndex('competition_activity_projections', ['team_id'], {
      name: 'idx_activity_team',
    });
    await queryInterface.addIndex('competition_activity_projections', ['season_id'], {
      name: 'idx_activity_season',
    });
    await queryInterface.addIndex('competition_activity_projections', ['grand_id'], {
      name: 'idx_activity_grand',
    });

    // 6. PROJECTION CHECKPOINTS
    await queryInterface.createTable('projection_checkpoints', {
      projection_name: {
        type: Sequelize.STRING(100),
        primaryKey: true,
        allowNull: false,
      },
      projection_version: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: '1.0.0',
      },
      last_event_id: {
        type: Sequelize.STRING(191),
        allowNull: true,
      },
      last_processed_sequence: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      last_processed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('ACTIVE', 'REBUILDING', 'PAUSED', 'ERROR'),
        allowNull: false,
        defaultValue: 'ACTIVE',
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('projection_checkpoints');
    await queryInterface.dropTable('competition_activity_projections');
    await queryInterface.dropTable('grand_leaderboard_projections');
    await queryInterface.dropTable('season_leaderboard_projections');
    await queryInterface.dropTable('competition_team_summaries');
    await queryInterface.dropTable('competition_user_summaries');
  },
};

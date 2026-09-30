'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. RULE SETS
    await queryInterface.createTable('rule_sets', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      code: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_by: {
        type: Sequelize.BIGINT.UNSIGNED,
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

    // 2. RULE SET VERSIONS (UUID PK to match score_ledger.rule_version_id)
    await queryInterface.createTable('rule_set_versions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      rule_set_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
      },
      version_number: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
      },
      effective_from: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      effective_to: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      ast_payload: {
        type: Sequelize.JSON,
        allowNull: false,
        comment: 'Array of validated rule definitions',
      },
      status: {
        type: Sequelize.ENUM('DRAFT', 'PUBLISHED', 'SUPERSEDED'),
        allowNull: false,
        defaultValue: 'DRAFT',
      },
      created_by: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      published_at: {
        type: Sequelize.DATE,
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

    await queryInterface.addIndex('rule_set_versions', ['rule_set_id', 'version_number'], {
      unique: true,
      name: 'uidx_rule_set_version',
    });

    // 3. SEASONS
    await queryInterface.createTable('seasons', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      slug: {
        type: Sequelize.STRING(150),
        allowNull: false,
        unique: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      season_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'MONTHLY',
        comment: 'MONTHLY, QUARTERLY, SPRINT, SPECIAL',
      },
      status: {
        type: Sequelize.ENUM('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'CALCULATING', 'FINISHED', 'ARCHIVED'),
        allowNull: false,
        defaultValue: 'DRAFT',
      },
      start_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      end_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      grace_period_hours: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 2,
      },
      timezone: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'Asia/Ho_Chi_Minh',
      },
      active_rule_set_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      active_rule_version_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      grand_points_distribution: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Rank-to-points mapping: [{ rank: 1, points: 10 }, ...]',
      },
      config: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      created_by: {
        type: Sequelize.BIGINT.UNSIGNED,
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

    await queryInterface.addIndex('seasons', ['status'], { name: 'idx_seasons_status' });

    // 4. SEASON TEAMS (Snapshots)
    await queryInterface.createTable('season_teams', {
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
      team_name_snapshot: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      team_avatar_snapshot: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      team_color_snapshot: {
        type: Sequelize.STRING(32),
        allowNull: true,
      },
      is_eligible: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      is_disqualified: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      joined_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      left_at: {
        type: Sequelize.DATE,
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

    await queryInterface.addIndex('season_teams', ['season_id', 'team_id'], {
      unique: true,
      name: 'uidx_season_team',
    });

    // 5. SEASON TEAM MEMBERS (Snapshots)
    await queryInterface.createTable('season_team_members', {
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
      user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
      },
      role_snapshot: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'member',
      },
      joined_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      left_at: {
        type: Sequelize.DATE,
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

    await queryInterface.addIndex('season_team_members', ['season_id', 'user_id'], {
      unique: true,
      name: 'uidx_season_user',
    });

    // 6. CHALLENGES
    await queryInterface.createTable('challenges', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      season_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
      },
      code: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'RACE',
        comment: 'RACE, MILESTONE, SYNERGY, TIME_ATTACK, QUALITY, CUSTOM',
      },
      target_value: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 10,
      },
      config: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      start_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      end_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('DRAFT', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED'),
        allowNull: false,
        defaultValue: 'DRAFT',
      },
      completed_by_team_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      completed_at: {
        type: Sequelize.DATE,
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

    await queryInterface.addIndex('challenges', ['season_id', 'code'], {
      name: 'idx_challenges_season_code',
    });

    // 7. SEASON FROZEN RESULTS
    await queryInterface.createTable('season_frozen_results', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      season_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        unique: true,
      },
      final_rankings: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      grand_points_awarded: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      frozen_at: {
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

    // 8. COMPETITION AUDIT LOGS
    await queryInterface.createTable('competition_audit_logs', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      actor_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      action: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      entity_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      entity_id: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      before_state: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      after_state: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('competition_audit_logs', ['entity_type', 'entity_id'], {
      name: 'idx_comp_audit_entity',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('competition_audit_logs');
    await queryInterface.dropTable('season_frozen_results');
    await queryInterface.dropTable('challenges');
    await queryInterface.dropTable('season_team_members');
    await queryInterface.dropTable('season_teams');
    await queryInterface.dropTable('seasons');
    await queryInterface.dropTable('rule_set_versions');
    await queryInterface.dropTable('rule_sets');
  },
};

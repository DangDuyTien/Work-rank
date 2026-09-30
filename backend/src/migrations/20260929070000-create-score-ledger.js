'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('score_ledger', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      // Nullable targets — Effect Engine enforces invariant by effect_type (not DB)
      season_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        comment: 'NULL = test / no-season context',
      },
      user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        comment: 'Required for INDIVIDUAL_XP; null for team-only effects',
      },
      team_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        comment: 'Required for TEAM_SCORE; null for individual-only effects',
      },
      // Source references
      event_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      rule_version_id: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Null for test/admin-injected entries',
      },
      // Idempotency: UNIQUE(idempotency_key, effect_type)
      idempotency_key: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      effect_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'e.g. INDIVIDUAL_XP, TEAM_SCORE',
      },
      // Signed integer: positive = credit, negative = debit/penalty
      points_delta: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Extra audit data (rule name, formula snapshot, etc.)',
      },
      // Set only on adjustment/reconciliation rows
      reconciliation_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      // INSERT-ONLY — no updated_at
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // PRIMARY idempotency guard — DB-level, not application-level
    await queryInterface.addIndex('score_ledger', ['idempotency_key', 'effect_type'], {
      unique: true,
      name: 'uidx_ledger_idempotency',
    });

    // Fast aggregation by season + user (leaderboard SUM)
    await queryInterface.addIndex('score_ledger', ['season_id', 'user_id'], {
      name: 'idx_ledger_season_user',
    });

    // Fast aggregation by season + team
    await queryInterface.addIndex('score_ledger', ['season_id', 'team_id'], {
      name: 'idx_ledger_season_team',
    });

    // Trace back from event → all its effects
    await queryInterface.addIndex('score_ledger', ['event_id'], {
      name: 'idx_ledger_event',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('score_ledger');
  },
};

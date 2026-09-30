'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. GRAND CHAMPIONSHIPS TABLE
    await queryInterface.createTable('grand_championships', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      year: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
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
      status: {
        type: Sequelize.ENUM('DRAFT', 'SCHEDULED', 'ACTIVE', 'CALCULATING', 'FINISHED', 'ARCHIVED'),
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
      timezone: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'Asia/Ho_Chi_Minh',
      },
      points_config: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      rewards_config: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      tiebreak_config: {
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

    await queryInterface.addIndex('grand_championships', ['year'], { name: 'idx_grand_champ_year' });
    await queryInterface.addIndex('grand_championships', ['status'], { name: 'idx_grand_champ_status' });

    // 2. LINK SEASONS TO GRAND CHAMPIONSHIP
    await queryInterface.addColumn('seasons', 'grand_championship_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
      comment: 'Linked Grand Championship for annual points settlement',
    });

    await queryInterface.addIndex('seasons', ['grand_championship_id'], { name: 'idx_seasons_grand_champ' });

    // 3. GRAND POINTS LEDGER TABLE (Append-Only / Insert-Only with Reversal Support)
    await queryInterface.createTable('grand_points_ledger', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      grand_championship_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
      },
      season_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
      },
      team_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
      },
      rank_position: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
      },
      grand_points_awarded: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      settlement_key: {
        type: Sequelize.STRING(191),
        allowNull: false,
        unique: true,
        comment: 'Deterministic settlement key for idempotency',
      },
      reason: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      source_result_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      is_reversal: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      original_ledger_id: {
        type: Sequelize.UUID,
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
    });

    await queryInterface.addIndex('grand_points_ledger', ['grand_championship_id', 'team_id'], {
      name: 'idx_grand_points_team',
    });
    await queryInterface.addIndex('grand_points_ledger', ['season_id'], {
      name: 'idx_grand_points_season',
    });

    // 4. GRAND FROZEN RESULTS TABLE
    await queryInterface.createTable('grand_frozen_results', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      grand_championship_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        unique: true,
      },
      champion_team_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
      },
      final_standings: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      season_summaries: {
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable('grand_frozen_results');
    await queryInterface.dropTable('grand_points_ledger');
    await queryInterface.removeColumn('seasons', 'grand_championship_id');
    await queryInterface.dropTable('grand_championships');
  },
};

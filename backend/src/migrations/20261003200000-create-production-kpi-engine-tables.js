'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create production_kpi_rules table
    const hasRules = await queryInterface.describeTable('production_kpi_rules').then(() => true).catch(() => false);
    if (!hasRules) {
      await queryInterface.createTable('production_kpi_rules', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        version: {
          type: Sequelize.STRING(64),
          allowNull: false,
          comment: 'KPI Rule Version e.g. v1.0, 2026-Q4, excel_20261003',
        },
        role: {
          type: Sequelize.STRING(32),
          allowNull: false,
          comment: 'EDITOR or CONTENT',
        },
        task_type: {
          type: Sequelize.STRING(64),
          allowNull: false,
          comment: 'e.g. EPISODE_FULL, EPISODE_SHORT, SCRIPT_STANDARD, SCRIPT_FEATURE',
        },
        metric: {
          type: Sequelize.STRING(64),
          allowNull: false,
          comment: 'COMPLETION_DURATION, WEEKLY_OUTPUT_AND_AVG_TIME',
        },
        unit: {
          type: Sequelize.STRING(32),
          allowNull: false,
          defaultValue: 'minutes',
        },
        standard_time: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 0,
          comment: 'Benchmark duration in minutes from company Excel',
        },
        target_value: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 1,
          comment: 'Target quota/quantity from company Excel',
        },
        point_base: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 100,
          comment: 'Base competition points at standard benchmark',
        },
        xp_base: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 100,
          comment: 'Base XP at standard benchmark',
        },
        scoring_mode: {
          type: Sequelize.STRING(64),
          allowNull: false,
          defaultValue: 'SPEED_EFFICIENCY_CURVE',
          comment: 'SPEED_EFFICIENCY_CURVE, WEEKLY_OUTPUT_AVERAGE_CURVE, LINEAR',
        },
        difficulty_tier: {
          type: Sequelize.STRING(32),
          allowNull: true,
          defaultValue: 'STANDARD',
          comment: 'STANDARD, EASY, HARD, FEATURE',
        },
        weight: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 1.0,
        },
        source_file_name: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        source_sheet_name: {
          type: Sequelize.STRING(128),
          allowNull: true,
        },
        source_row_index: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        status: {
          type: Sequelize.STRING(32),
          allowNull: false,
          defaultValue: 'DRAFT',
          comment: 'DRAFT, ACTIVE, DEPRECATED, ARCHIVED',
        },
        effective_from: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        effective_to: {
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
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });

      await queryInterface.addIndex('production_kpi_rules', ['version', 'role', 'task_type'], {
        name: 'idx_prod_kpi_version_role_task',
      }).catch(() => {});
      await queryInterface.addIndex('production_kpi_rules', ['status', 'active'], {
        name: 'idx_prod_kpi_status_active',
      }).catch(() => {});
    }

    // 2. Create production_kpi_activations table
    const hasActivations = await queryInterface.describeTable('production_kpi_activations').then(() => true).catch(() => false);
    if (!hasActivations) {
      await queryInterface.createTable('production_kpi_activations', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        version: {
          type: Sequelize.STRING(64),
          allowNull: false,
        },
        role: {
          type: Sequelize.STRING(32),
          allowNull: false,
          defaultValue: 'ALL',
          comment: 'EDITOR, CONTENT, or ALL',
        },
        season_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
        },
        team_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
        },
        status: {
          type: Sequelize.STRING(32),
          allowNull: false,
          defaultValue: 'ACTIVE',
        },
        effective_from: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        effective_to: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        activated_by: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
        },
        reason: {
          type: Sequelize.TEXT,
          allowNull: true,
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
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });

      await queryInterface.addIndex('production_kpi_activations', ['version', 'role', 'status'], {
        name: 'idx_prod_kpi_act_ver_role',
      }).catch(() => {});
    }

    // 3. Create production_kpi_execution_snapshots table
    const hasSnapshots = await queryInterface.describeTable('production_kpi_execution_snapshots').then(() => true).catch(() => false);
    if (!hasSnapshots) {
      await queryInterface.createTable('production_kpi_execution_snapshots', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        rule_id: {
          type: Sequelize.UUID,
          allowNull: true,
        },
        rule_version: {
          type: Sequelize.STRING(64),
          allowNull: false,
        },
        role: {
          type: Sequelize.STRING(32),
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
        season_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
        },
        task_id: {
          type: Sequelize.STRING(128),
          allowNull: false,
          comment: 'Episode ID, Script ID, or Week Key',
        },
        task_type: {
          type: Sequelize.STRING(64),
          allowNull: false,
        },
        metric: {
          type: Sequelize.STRING(64),
          allowNull: false,
        },
        actual_value: {
          type: Sequelize.FLOAT,
          allowNull: false,
        },
        standard_value: {
          type: Sequelize.FLOAT,
          allowNull: false,
        },
        performance_ratio: {
          type: Sequelize.FLOAT,
          allowNull: false,
        },
        efficiency_rating: {
          type: Sequelize.STRING(32),
          allowNull: true,
        },
        points_awarded: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        xp_awarded: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        event_id: {
          type: Sequelize.UUID,
          allowNull: true,
        },
        ledger_id: {
          type: Sequelize.UUID,
          allowNull: true,
        },
        idempotency_key: {
          type: Sequelize.STRING(255),
          allowNull: false,
          unique: true,
        },
        started_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        completed_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        calculated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        details: {
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
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });

      await queryInterface.addIndex('production_kpi_execution_snapshots', ['idempotency_key'], {
        unique: true,
        name: 'uidx_prod_kpi_snap_idempotency',
      }).catch(() => {});
      await queryInterface.addIndex('production_kpi_execution_snapshots', ['user_id', 'role'], {
        name: 'idx_prod_kpi_snap_user_role',
      }).catch(() => {});
      await queryInterface.addIndex('production_kpi_execution_snapshots', ['season_id'], {
        name: 'idx_prod_kpi_snap_season',
      }).catch(() => {});
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('production_kpi_execution_snapshots').catch(() => {});
    await queryInterface.dropTable('production_kpi_activations').catch(() => {});
    await queryInterface.dropTable('production_kpi_rules').catch(() => {});
  },
};

'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class ProductionKpiExecutionSnapshot extends Model {}

ProductionKpiExecutionSnapshot.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    ruleId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'rule_id',
    },
    ruleVersion: {
      type: DataTypes.STRING(64),
      allowNull: false,
      field: 'rule_version',
    },
    role: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    userId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: 'user_id',
    },
    teamId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: 'team_id',
    },
    seasonId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: 'season_id',
    },
    taskId: {
      type: DataTypes.STRING(128),
      allowNull: false,
      field: 'task_id',
      comment: 'Episode ID, Script ID, or Week Key',
    },
    taskType: {
      type: DataTypes.STRING(64),
      allowNull: false,
      field: 'task_type',
    },
    metric: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    actualValue: {
      type: DataTypes.FLOAT,
      allowNull: false,
      field: 'actual_value',
    },
    standardValue: {
      type: DataTypes.FLOAT,
      allowNull: false,
      field: 'standard_value',
    },
    performanceRatio: {
      type: DataTypes.FLOAT,
      allowNull: false,
      field: 'performance_ratio',
    },
    efficiencyRating: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'efficiency_rating',
    },
    pointsAwarded: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'points_awarded',
    },
    xpAwarded: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'xp_awarded',
    },
    eventId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'event_id',
    },
    ledgerId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'ledger_id',
    },
    idempotencyKey: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      field: 'idempotency_key',
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'started_at',
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'completed_at',
    },
    calculatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'calculated_at',
    },
    details: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'ProductionKpiExecutionSnapshot',
    tableName: 'production_kpi_execution_snapshots',
    underscored: true,
  }
);

module.exports = ProductionKpiExecutionSnapshot;

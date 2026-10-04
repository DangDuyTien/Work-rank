'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class ProductionKpiRule extends Model {}

ProductionKpiRule.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    version: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING(32),
      allowNull: false,
      comment: 'EDITOR or CONTENT',
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
    unit: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'minutes',
    },
    standardTime: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
      field: 'standard_time',
      comment: 'Benchmark duration in minutes from company Excel',
    },
    targetValue: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 1,
      field: 'target_value',
    },
    pointBase: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100,
      field: 'point_base',
    },
    xpBase: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100,
      field: 'xp_base',
    },
    scoringMode: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: 'SPEED_EFFICIENCY_CURVE',
      field: 'scoring_mode',
    },
    difficultyTier: {
      type: DataTypes.STRING(32),
      allowNull: true,
      defaultValue: 'STANDARD',
      field: 'difficulty_tier',
    },
    weight: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 1.0,
    },
    sourceFileName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'source_file_name',
    },
    sourceSheetName: {
      type: DataTypes.STRING(128),
      allowNull: true,
      field: 'source_sheet_name',
    },
    sourceRowIndex: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'source_row_index',
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'DRAFT',
    },
    effectiveFrom: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'effective_from',
    },
    effectiveTo: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'effective_to',
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'ProductionKpiRule',
    tableName: 'production_kpi_rules',
    underscored: true,
  }
);

module.exports = ProductionKpiRule;

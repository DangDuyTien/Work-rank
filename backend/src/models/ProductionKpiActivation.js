'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class ProductionKpiActivation extends Model {}

ProductionKpiActivation.init(
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
      defaultValue: 'ALL',
      comment: 'EDITOR, CONTENT, or ALL',
    },
    seasonId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: 'season_id',
    },
    teamId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: 'team_id',
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
    effectiveFrom: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'effective_from',
    },
    effectiveTo: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'effective_to',
    },
    activatedBy: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: 'activated_by',
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'ProductionKpiActivation',
    tableName: 'production_kpi_activations',
    underscored: true,
  }
);

module.exports = ProductionKpiActivation;

'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Season extends Model {}

Season.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(150), allowNull: false },
    slug: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    seasonType: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'MONTHLY', field: 'season_type' },
    status: {
      type: DataTypes.ENUM('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'CALCULATING', 'FINISHED', 'ARCHIVED'),
      allowNull: false,
      defaultValue: 'DRAFT',
    },
    startAt: { type: DataTypes.DATE, allowNull: false, field: 'start_at' },
    endAt: { type: DataTypes.DATE, allowNull: false, field: 'end_at' },
    gracePeriodHours: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 2, field: 'grace_period_hours' },
    timezone: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'Asia/Ho_Chi_Minh' },
    activeRuleSetId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'active_rule_set_id' },
    activeRuleVersionId: { type: DataTypes.UUID, allowNull: true, field: 'active_rule_version_id' },
    grandChampionshipId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'grand_championship_id' },
    grandPointsDistribution: { type: DataTypes.JSON, allowNull: true, field: 'grand_points_distribution' },
    config: { type: DataTypes.JSON, allowNull: true },
    createdBy: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'created_by' },
  },
  { sequelize, modelName: 'Season', tableName: 'seasons', underscored: true },
);

module.exports = Season;

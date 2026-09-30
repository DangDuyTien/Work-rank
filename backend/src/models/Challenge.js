'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Challenge extends Model {}

Challenge.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    seasonId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'season_id' },
    code: { type: DataTypes.STRING(64), allowNull: false },
    title: { type: DataTypes.STRING(150), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    type: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'RACE' },
    targetValue: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10, field: 'target_value' },
    config: { type: DataTypes.JSON, allowNull: true },
    startAt: { type: DataTypes.DATE, allowNull: true, field: 'start_at' },
    endAt: { type: DataTypes.DATE, allowNull: true, field: 'end_at' },
    status: {
      type: DataTypes.ENUM('DRAFT', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED'),
      allowNull: false,
      defaultValue: 'DRAFT',
    },
    completedByTeamId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'completed_by_team_id' },
    completedAt: { type: DataTypes.DATE, allowNull: true, field: 'completed_at' },
  },
  { sequelize, modelName: 'Challenge', tableName: 'challenges', underscored: true },
);

module.exports = Challenge;

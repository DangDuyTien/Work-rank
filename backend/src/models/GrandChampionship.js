'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class GrandChampionship extends Model {}

GrandChampionship.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    year: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    name: { type: DataTypes.STRING(150), allowNull: false },
    slug: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM('DRAFT', 'SCHEDULED', 'ACTIVE', 'CALCULATING', 'FINISHED', 'ARCHIVED'),
      allowNull: false,
      defaultValue: 'DRAFT',
    },
    startAt: { type: DataTypes.DATE, allowNull: false, field: 'start_at' },
    endAt: { type: DataTypes.DATE, allowNull: false, field: 'end_at' },
    timezone: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'Asia/Ho_Chi_Minh' },
    pointsConfig: { type: DataTypes.JSON, allowNull: true, field: 'points_config' },
    rewardsConfig: { type: DataTypes.JSON, allowNull: true, field: 'rewards_config' },
    tiebreakConfig: { type: DataTypes.JSON, allowNull: true, field: 'tiebreak_config' },
    createdBy: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'created_by' },
  },
  { sequelize, modelName: 'GrandChampionship', tableName: 'grand_championships', underscored: true },
);

module.exports = GrandChampionship;

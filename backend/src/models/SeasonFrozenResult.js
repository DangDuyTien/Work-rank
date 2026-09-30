'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class SeasonFrozenResult extends Model {}

SeasonFrozenResult.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    seasonId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, unique: true, field: 'season_id' },
    finalRankings: { type: DataTypes.JSON, allowNull: false, field: 'final_rankings' },
    grandPointsAwarded: { type: DataTypes.JSON, allowNull: true, field: 'grand_points_awarded' },
    metadata: { type: DataTypes.JSON, allowNull: true },
    frozenAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'frozen_at' },
  },
  { sequelize, modelName: 'SeasonFrozenResult', tableName: 'season_frozen_results', underscored: true },
);

module.exports = SeasonFrozenResult;

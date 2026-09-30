'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class GrandFrozenResult extends Model {}

GrandFrozenResult.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    grandChampionshipId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, unique: true, field: 'grand_championship_id' },
    championTeamId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'champion_team_id' },
    finalStandings: { type: DataTypes.JSON, allowNull: false, field: 'final_standings' },
    seasonSummaries: { type: DataTypes.JSON, allowNull: true, field: 'season_summaries' },
    metadata: { type: DataTypes.JSON, allowNull: true },
    frozenAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'frozen_at' },
  },
  { sequelize, modelName: 'GrandFrozenResult', tableName: 'grand_frozen_results', underscored: true },
);

module.exports = GrandFrozenResult;

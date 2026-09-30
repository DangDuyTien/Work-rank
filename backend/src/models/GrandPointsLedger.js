'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class GrandPointsLedger extends Model {}

GrandPointsLedger.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    grandChampionshipId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'grand_championship_id' },
    seasonId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'season_id' },
    teamId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'team_id' },
    rankPosition: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'rank_position' },
    grandPointsAwarded: { type: DataTypes.INTEGER, allowNull: false, field: 'grand_points_awarded' },
    settlementKey: { type: DataTypes.STRING(191), allowNull: false, unique: true, field: 'settlement_key' },
    reason: { type: DataTypes.STRING(255), allowNull: true },
    sourceResultId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'source_result_id' },
    isReversal: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_reversal' },
    originalLedgerId: { type: DataTypes.UUID, allowNull: true, field: 'original_ledger_id' },
    metadata: { type: DataTypes.JSON, allowNull: true },
  },
  {
    sequelize,
    modelName: 'GrandPointsLedger',
    tableName: 'grand_points_ledger',
    underscored: true,
    updatedAt: false, // Append-only / Insert-only ledger
  },
);

module.exports = GrandPointsLedger;

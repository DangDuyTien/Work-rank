'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class SamResult extends Model {}

SamResult.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    roomId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'room_id' },
    winnerUserId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'winner_user_id' },
    details: { type: DataTypes.JSON, allowNull: false },
  },
  {
    sequelize,
    modelName: 'SamResult',
    tableName: 'sam_results',
    underscored: true,
    timestamps: true,
    updatedAt: false,
  }
);

module.exports = SamResult;

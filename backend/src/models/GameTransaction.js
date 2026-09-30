'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class GameTransaction extends Model {}

GameTransaction.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    roomId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'room_id' },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    type: { type: DataTypes.STRING(50), allowNull: false },
    amount: { type: DataTypes.INTEGER, allowNull: false },
    balanceBefore: { type: DataTypes.INTEGER, allowNull: false, field: 'balance_before' },
    balanceAfter: { type: DataTypes.INTEGER, allowNull: false, field: 'balance_after' },
    referenceType: { type: DataTypes.STRING(50), allowNull: true, field: 'reference_type' },
    referenceId: { type: DataTypes.STRING(50), allowNull: true, field: 'reference_id' },
    metadata: { type: DataTypes.JSON, allowNull: true },
  },
  {
    sequelize,
    modelName: 'GameTransaction',
    tableName: 'game_transactions',
    underscored: true,
    updatedAt: false,
    indexes: [
      { fields: ['room_id', 'created_at'], name: 'idx_game_tx_room_created' },
      { fields: ['user_id', 'created_at'], name: 'idx_game_tx_user_created' },
    ],
  }
);

module.exports = GameTransaction;

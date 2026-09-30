'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class GameResult extends Model {}

GameResult.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    roomId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'room_id' },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    finalCash: { type: DataTypes.INTEGER, allowNull: false, field: 'final_cash' },
    finalPropertyValue: { type: DataTypes.INTEGER, allowNull: false, field: 'final_property_value' },
    finalNetWorth: { type: DataTypes.INTEGER, allowNull: false, field: 'final_net_worth' },
    rank: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    rewardAmount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'reward_amount' },
  },
  {
    sequelize,
    modelName: 'GameResult',
    tableName: 'game_results',
    underscored: true,
    updatedAt: false,
    indexes: [
      { fields: ['user_id', 'created_at'], name: 'idx_game_results_user_created' },
      { fields: ['room_id'], name: 'idx_game_results_room' },
    ],
  }
);

module.exports = GameResult;

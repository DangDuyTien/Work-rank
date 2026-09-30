'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class GamePlayer extends Model {}

GamePlayer.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    roomId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'room_id' },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    seatIndex: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'seat_index' },
    color: { type: DataTypes.STRING(30), allowNull: false, defaultValue: '#38bdf8' },
    position: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    cash: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1500 },
    status: {
      type: DataTypes.ENUM('WAITING', 'ACTIVE', 'BANKRUPT', 'SURRENDERED', 'DISCONNECTED'),
      allowNull: false,
      defaultValue: 'WAITING',
    },
    joinedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'joined_at' },
    finalCash: { type: DataTypes.INTEGER, allowNull: true, field: 'final_cash' },
    finalPropertyValue: { type: DataTypes.INTEGER, allowNull: true, field: 'final_property_value' },
    finalNetWorth: { type: DataTypes.INTEGER, allowNull: true, field: 'final_net_worth' },
    rank: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  },
  {
    sequelize,
    modelName: 'GamePlayer',
    tableName: 'game_players',
    underscored: true,
    indexes: [
      { unique: true, fields: ['room_id', 'user_id'], name: 'unique_room_user' },
      { unique: true, fields: ['room_id', 'seat_index'], name: 'unique_room_seat' },
    ],
  }
);

module.exports = GamePlayer;

'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class GameRoom extends Model {}

GameRoom.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    title: { type: DataTypes.STRING(120), allowNull: false },
    hostUserId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'host_user_id' },
    status: {
      type: DataTypes.ENUM('WAITING', 'PLAYING', 'FINISHED', 'ABANDONED'),
      allowNull: false,
      defaultValue: 'WAITING',
    },
    maxPlayers: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 4, field: 'max_players' },
    currentTurnPlayerId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'current_turn_player_id' },
    turnNumber: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1, field: 'turn_number' },
    turnDeadline: { type: DataTypes.DATE, allowNull: true, field: 'turn_deadline' },
    winnerUserId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'winner_user_id' },
    startedAt: { type: DataTypes.DATE, allowNull: true, field: 'started_at' },
    finishedAt: { type: DataTypes.DATE, allowNull: true, field: 'finished_at' },
    lastDiceResult: { type: DataTypes.JSON, allowNull: true, field: 'last_dice_result' },
    turnState: { type: DataTypes.JSON, allowNull: true, field: 'turn_state' }, // { rolled: boolean, movedToTile: number, canBuy: boolean, ... }
  },
  { sequelize, modelName: 'GameRoom', tableName: 'game_rooms', underscored: true }
);

module.exports = GameRoom;

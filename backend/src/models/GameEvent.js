'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class GameEvent extends Model {}

GameEvent.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    roomId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'room_id' },
    turnNumber: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1, field: 'turn_number' },
    type: { type: DataTypes.STRING(50), allowNull: false },
    actorUserId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'actor_user_id' },
    payload: { type: DataTypes.JSON, allowNull: true },
  },
  {
    sequelize,
    modelName: 'GameEvent',
    tableName: 'game_events',
    underscored: true,
    updatedAt: false,
    indexes: [
      { fields: ['room_id', 'created_at'], name: 'idx_game_events_room_created' },
    ],
  }
);

module.exports = GameEvent;

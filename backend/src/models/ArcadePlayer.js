'use strict';
const { DataTypes: D, Model } = require('sequelize');
const sequelize = require('../config/database');
class ArcadePlayer extends Model {}
ArcadePlayer.init({
  id: { type: D.STRING(36), primaryKey: true },
  roomId: { type: D.STRING(36), allowNull: false },
  userId: { type: D.BIGINT.UNSIGNED, allowNull: false },
  // 'A' | 'B' cho mode đội (2V2/3V3). NULL cho SOLO/1V1/TRIO.
  team: { type: D.STRING(1) },
  ready: { type: D.BOOLEAN, allowNull: false, defaultValue: false },
  revision: { type: D.INTEGER, allowNull: false, defaultValue: 0 },
  events: { type: D.JSON, allowNull: false, defaultValue: [] },
  heartbeatAt: { type: D.DATE, allowNull: false },
  finishedAt: { type: D.DATE },
  result: { type: D.JSON },
}, { sequelize, modelName: 'ArcadePlayer', tableName: 'arcade_players', underscored: true, indexes: [{ unique: true, fields: ['room_id', 'user_id'] }, { fields: ['user_id', 'finished_at'] }] });
module.exports = ArcadePlayer;

'use strict';
const { DataTypes: D, Model } = require('sequelize');
const sequelize = require('../config/database');
class ArcadeRoom extends Model {}
ArcadeRoom.init({
  id: { type: D.STRING(36), primaryKey: true },
  gameType: { type: D.STRING(32), allowNull: false },
  mode: { type: D.STRING(8), allowNull: false },
  capacity: { type: D.INTEGER, allowNull: false },
  hostId: { type: D.BIGINT.UNSIGNED, allowNull: false },
  title: { type: D.STRING(100), allowNull: false },
  status: { type: D.STRING(16), allowNull: false, defaultValue: 'WAITING' },
  seed: { type: D.STRING(64), allowNull: false },
  difficulty: { type: D.STRING(16), allowNull: false, defaultValue: 'mixed' },
  durationSeconds: { type: D.INTEGER, allowNull: false, defaultValue: 60 },
  startedAt: { type: D.DATE },
  revision: { type: D.INTEGER, allowNull: false, defaultValue: 0 },
}, { sequelize, modelName: 'ArcadeRoom', tableName: 'arcade_rooms', underscored: true, indexes: [{ fields: ['game_type', 'status', 'mode'] }] });
module.exports = ArcadeRoom;

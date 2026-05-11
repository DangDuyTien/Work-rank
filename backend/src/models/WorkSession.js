const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class WorkSession extends Model {}

WorkSession.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    deviceId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'device_id' },
    startedAt: { type: DataTypes.DATE, allowNull: false, field: 'started_at' },
    endedAt: { type: DataTypes.DATE, allowNull: true, field: 'ended_at' },
    durationSeconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'duration_seconds' },
    activeSeconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'active_seconds' },
    idleSeconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'idle_seconds' },
    keystrokeCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'keystroke_count' },
    mouseClickCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'mouse_click_count' },
    mouseMoveCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'mouse_move_count' },
    status: { type: DataTypes.ENUM('running', 'ended', 'crashed'), allowNull: false, defaultValue: 'running' },
  },
  { sequelize, modelName: 'WorkSession', tableName: 'work_sessions' },
);

module.exports = WorkSession;

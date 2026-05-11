const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class ActivityEvent extends Model {}

ActivityEvent.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    deviceId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'device_id' },
    sessionId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'session_id' },
    eventTime: { type: DataTypes.DATE, allowNull: false, field: 'event_time' },
    sequence: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    signatureValid: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'signature_valid' },
    suspicionScore: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'suspicion_score' },
    flagsJson: { type: DataTypes.JSON, allowNull: true, field: 'flags_json' },
    activeSeconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'active_seconds' },
    idleSeconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'idle_seconds' },
    keystrokeCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'keystroke_count' },
    mouseClickCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'mouse_click_count' },
    mouseMoveCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'mouse_move_count' },
    metadataJson: { type: DataTypes.JSON, allowNull: true, field: 'metadata_json' },
  },
  { sequelize, modelName: 'ActivityEvent', tableName: 'activity_events', updatedAt: false },
);

module.exports = ActivityEvent;

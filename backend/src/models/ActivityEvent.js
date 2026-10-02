'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class ActivityEvent extends Model {}

ActivityEvent.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'user_id' },
    sessionId: { type: DataTypes.STRING(128), allowNull: true, field: 'session_id' },
    eventType: {
      type: DataTypes.ENUM('CLICK', 'KEYBOARD_ACTIVITY'),
      allowNull: false,
      field: 'event_type',
    },
    route: { type: DataTypes.STRING(255), allowNull: true },
    occurredAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'occurred_at' },
    receivedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'received_at' },
    metadata: { type: DataTypes.JSON, allowNull: true },
  },
  {
    sequelize,
    modelName: 'ActivityEvent',
    tableName: 'activity_events',
    underscored: true,
    timestamps: true,
  },
);

module.exports = ActivityEvent;

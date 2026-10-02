'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class ComputerActivityEvent extends Model {}

ComputerActivityEvent.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: 'user_id',
    },
    sessionId: {
      type: DataTypes.STRING(128),
      allowNull: true,
      field: 'session_id',
    },
    state: {
      type: DataTypes.ENUM('ACTIVE', 'IDLE'),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
    activeApp: {
      type: DataTypes.STRING(128),
      allowNull: true,
      field: 'active_app',
    },
    appCategory: {
      type: DataTypes.STRING(64),
      allowNull: true,
      defaultValue: 'OTHER',
      field: 'app_category',
    },
    context: {
      type: DataTypes.STRING(64),
      allowNull: true,
      defaultValue: 'COMPUTER',
    },
    activeSeconds: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'active_seconds',
    },
    idleSeconds: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'idle_seconds',
    },
    mouseClicks: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'mouse_clicks',
    },
    keyboardCount: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'keyboard_count',
    },
    occurredAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'occurred_at',
    },
    devicePlatform: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'macos',
      field: 'device_platform',
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'ComputerActivityEvent',
    tableName: 'computer_activity_events',
    underscored: true,
    timestamps: true,
  },
);

module.exports = ComputerActivityEvent;

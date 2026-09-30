'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class EventOutbox extends Model {}

EventOutbox.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    idempotencyKey: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      field: 'idempotency_key',
    },
    eventType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'event_type',
    },
    payload: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'DISPATCHED', 'FAILED'),
      allowNull: false,
      defaultValue: 'PENDING',
    },
    attemptCount: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'attempt_count',
    },
    availableAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'available_at',
    },
    processedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'processed_at',
    },
    lastError: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'last_error',
    },
  },
  {
    sequelize,
    modelName: 'EventOutbox',
    tableName: 'event_outbox',
    underscored: true,
  },
);

module.exports = EventOutbox;

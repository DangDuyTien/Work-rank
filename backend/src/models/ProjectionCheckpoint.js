'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProjectionCheckpoint = sequelize.define(
  'ProjectionCheckpoint',
  {
    projectionName: {
      type: DataTypes.STRING(100),
      primaryKey: true,
      allowNull: false,
      field: 'projection_name',
    },
    projectionVersion: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: '1.0.0',
      field: 'projection_version',
    },
    lastEventId: {
      type: DataTypes.STRING(191),
      allowNull: true,
      field: 'last_event_id',
    },
    lastProcessedSequence: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'last_processed_sequence',
    },
    lastProcessedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_processed_at',
    },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'REBUILDING', 'PAUSED', 'ERROR'),
      allowNull: false,
      defaultValue: 'ACTIVE',
      field: 'status',
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: 'projection_checkpoints',
    underscored: true,
    timestamps: true,
  }
);

module.exports = ProjectionCheckpoint;

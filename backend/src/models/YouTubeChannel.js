'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class YouTubeChannel extends Model {}

YouTubeChannel.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    teamId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: 'team_id',
    },
    channelId: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
      field: 'channel_id',
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    customUrl: {
      type: DataTypes.STRING(128),
      allowNull: true,
      field: 'custom_url',
    },
    thumbnailUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'thumbnail_url',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'ERROR'),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
    syncStatus: {
      type: DataTypes.ENUM('IDLE', 'SYNCING', 'SUCCESS', 'ERROR'),
      allowNull: false,
      defaultValue: 'IDLE',
      field: 'sync_status',
    },
    lastSyncedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_synced_at',
    },
    lastSyncError: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'last_sync_error',
    },
  },
  {
    sequelize,
    modelName: 'YouTubeChannel',
    tableName: 'youtube_channels',
    underscored: true,
    timestamps: true,
  },
);

module.exports = YouTubeChannel;

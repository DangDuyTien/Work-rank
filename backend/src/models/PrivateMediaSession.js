'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Existing private sessions and opt-in shared listening use the same model.
// Timeline/queue are shared; volume and mute are device preferences.
const PrivateMediaSession = sequelize.define(
  'PrivateMediaSession',
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    sessionKey: { type: DataTypes.STRING(32), allowNull: false, unique: true, field: 'session_key' },
    status: {
      type: DataTypes.ENUM('IDLE', 'LOADING', 'PLAYING', 'PAUSED', 'STOPPED', 'ERROR'),
      allowNull: false,
      defaultValue: 'IDLE',
    },
    currentVideoId: { type: DataTypes.STRING(32), allowNull: true, field: 'current_video_id' },
    title: { type: DataTypes.STRING(255), allowNull: true },
    channelTitle: { type: DataTypes.STRING(191), allowNull: true, field: 'channel_title' },
    thumbnailUrl: { type: DataTypes.STRING(512), allowNull: true, field: 'thumbnail_url' },
    durationSeconds: { type: DataTypes.INTEGER, allowNull: true, field: 'duration_seconds' },
    currentTime: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0, field: 'current_time' },
    revision: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    referenceTime: { type: DataTypes.DATE, allowNull: true, field: 'reference_time' },
    currentQueueItemId: { type: DataTypes.STRING(36), allowNull: true, field: 'current_queue_item_id' },
    lastFailure: { type: DataTypes.JSON, allowNull: true, field: 'last_failure' },
    queue: { type: DataTypes.JSON, allowNull: true },
    queueIndex: { type: DataTypes.INTEGER, allowNull: false, defaultValue: -1, field: 'queue_index' },
    controllerUserId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'controller_user_id' },
    playerOnline: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'player_online' },
    playerLastSeenAt: { type: DataTypes.DATE, allowNull: true, field: 'player_last_seen_at' },
  },
  { tableName: 'private_media_sessions', underscored: true, timestamps: true },
);

module.exports = PrivateMediaSession;

'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class YouTubeChannelMetric extends Model {}

YouTubeChannelMetric.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    channelId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: 'channel_id',
    },
    capturedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'captured_at',
    },
    views: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
    subscribers: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
    watchTimeHours: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'watch_time_hours',
    },
    engagementRate: {
      type: DataTypes.DECIMAL(7, 4),
      allowNull: false,
      defaultValue: 0.0000,
      field: 'engagement_rate',
    },
  },
  {
    sequelize,
    modelName: 'YouTubeChannelMetric',
    tableName: 'youtube_channel_metrics',
    underscored: true,
    timestamps: true,
    updatedAt: false,
  },
);

module.exports = YouTubeChannelMetric;

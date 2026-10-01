'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class YouTubeVideoMetric extends Model {}

YouTubeVideoMetric.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    videoId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: 'video_id',
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
    likes: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
    comments: {
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
    modelName: 'YouTubeVideoMetric',
    tableName: 'youtube_video_metrics',
    underscored: true,
    timestamps: true,
    updatedAt: false,
  },
);

module.exports = YouTubeVideoMetric;

'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class YouTubeVideo extends Model {}

YouTubeVideo.init(
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
    videoId: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
      field: 'video_id',
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    publishedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'published_at',
    },
    thumbnailUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'thumbnail_url',
    },
    durationSeconds: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'duration_seconds',
    },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'DELETED', 'PRIVATE'),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
  },
  {
    sequelize,
    modelName: 'YouTubeVideo',
    tableName: 'youtube_videos',
    underscored: true,
    timestamps: true,
  },
);

module.exports = YouTubeVideo;

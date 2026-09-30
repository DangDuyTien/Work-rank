'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class TeamYouTubeSummary extends Model {}

TeamYouTubeSummary.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    teamId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      unique: true,
      field: 'team_id',
    },
    channelsCount: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'channels_count',
    },
    videosCount: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'videos_count',
    },
    totalViews: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'total_views',
    },
    totalSubscribers: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'total_subscribers',
    },
    viewsToday: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'views_today',
    },
    views7d: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'views_7d',
    },
    views30d: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'views_30d',
    },
    subscribersToday: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'subscribers_today',
    },
    subscriberGrowth7d: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'subscriber_growth_7d',
    },
    subscriberGrowth30d: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'subscriber_growth_30d',
    },
    viewsGrowth30dPct: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'views_growth_30d_pct',
    },
    subGrowth30dPct: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'sub_growth_30d_pct',
    },
    topVideoId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: 'top_video_id',
    },
    topVideoTitle: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'top_video_title',
    },
    topVideoViews: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'top_video_views',
    },
    rankByViews: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'rank_by_views',
    },
    rankBySubs: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'rank_by_subs',
    },
    rankByGrowth: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'rank_by_growth',
    },
    freshnessStatus: {
      type: DataTypes.ENUM('FRESH', 'STALE', 'FAILED'),
      allowNull: false,
      defaultValue: 'FRESH',
      field: 'freshness_status',
    },
    lastSyncedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_synced_at',
    },
  },
  {
    sequelize,
    modelName: 'TeamYouTubeSummary',
    tableName: 'team_youtube_summaries',
    underscored: true,
    timestamps: true,
  },
);

module.exports = TeamYouTubeSummary;

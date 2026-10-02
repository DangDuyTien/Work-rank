'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class ComputerDailyStat extends Model {}

ComputerDailyStat.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: 'user_id',
    },
    statDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'stat_date',
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
    activityScore: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'activity_score',
    },
    focusScore: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'focus_score',
    },
    activeAppsBreakdown: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'active_apps_breakdown',
    },
  },
  {
    sequelize,
    modelName: 'ComputerDailyStat',
    tableName: 'computer_daily_stats',
    underscored: true,
    timestamps: true,
  },
);

module.exports = ComputerDailyStat;

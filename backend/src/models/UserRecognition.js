'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class UserRecognition extends Model {}

UserRecognition.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: 'user_id',
    },
    awardType: {
      type: DataTypes.STRING(32),
      allowNull: false, // 'champion', 'mvp', 'dev', 'verified'
      field: 'award_type',
    },
    title: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    seasonId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: 'season_id',
    },
    grandId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: 'grand_id',
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    awardedBy: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: 'awarded_by',
    },
    awardedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'awarded_at',
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'UserRecognition',
    tableName: 'user_recognitions',
    underscored: true,
    timestamps: true,
  },
);

module.exports = UserRecognition;

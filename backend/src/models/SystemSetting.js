'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class SystemSetting extends Model {}

SystemSetting.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    settingKey: {
      type: DataTypes.STRING(128),
      allowNull: false,
      unique: true,
      field: 'setting_key',
    },
    settingValue: {
      type: DataTypes.JSON,
      allowNull: false,
      field: 'setting_value',
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'SystemSetting',
    tableName: 'system_settings',
    underscored: true,
    timestamps: true,
  },
);

module.exports = SystemSetting;

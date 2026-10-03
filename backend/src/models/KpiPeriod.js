'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class KpiPeriod extends Model {}

KpiPeriod.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    periodType: {
      type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'quarterly', 'custom'),
      allowNull: false,
      defaultValue: 'monthly',
      field: 'period_type',
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'start_date',
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'end_date',
    },
    status: {
      type: DataTypes.ENUM('UPCOMING', 'ACTIVE', 'CLOSED'),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'KpiPeriod',
    tableName: 'kpi_periods',
    underscored: true,
    timestamps: true,
  }
);

module.exports = KpiPeriod;

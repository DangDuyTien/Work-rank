'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Kpi extends Model {}

Kpi.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    departmentId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: 'department_id',
    },
    name: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    unit: {
      type: DataTypes.STRING(48),
      allowNull: false,
      defaultValue: 'đơn vị',
    },
    target: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    periodType: {
      type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'quarterly', 'custom'),
      allowNull: false,
      defaultValue: 'monthly',
      field: 'period_type',
    },
    sourceType: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: 'MANUAL',
      field: 'source_type',
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Kpi',
    tableName: 'kpis',
    underscored: true,
    timestamps: true,
  }
);

module.exports = Kpi;

'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class KpiResult extends Model {}

KpiResult.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: 'user_id',
    },
    departmentId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: 'department_id',
    },
    kpiId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: 'kpi_id',
    },
    periodId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: 'period_id',
    },
    targetValue: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'target_value',
    },
    actualValue: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'actual_value',
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED'),
      allowNull: false,
      defaultValue: 'IN_PROGRESS',
    },
    source: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: 'MANUAL',
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    calculatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'calculated_at',
    },
  },
  {
    sequelize,
    modelName: 'KpiResult',
    tableName: 'kpi_results',
    underscored: true,
    timestamps: true,
  }
);

module.exports = KpiResult;

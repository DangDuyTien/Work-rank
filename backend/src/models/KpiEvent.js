'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class KpiEvent extends Model {}

KpiEvent.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    kpiResultId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: 'kpi_result_id',
    },
    kpiId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: 'kpi_id',
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
    eventType: {
      type: DataTypes.STRING(64),
      allowNull: false,
      field: 'event_type',
    },
    valueDelta: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      field: 'value_delta',
    },
    previousValue: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      field: 'previous_value',
    },
    newValue: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      field: 'new_value',
    },
    source: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: 'MANUAL',
    },
    actorId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: 'actor_id',
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'KpiEvent',
    tableName: 'kpi_events',
    underscored: true,
    updatedAt: false, // Append-only audit log
  }
);

module.exports = KpiEvent;

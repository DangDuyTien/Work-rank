const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class SimulationSetting extends Model {}

SimulationSetting.init(
  {
    id: { type: DataTypes.TINYINT.UNSIGNED, primaryKey: true, allowNull: false },
    enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    targetCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 50, field: 'target_count' },
    intervalSeconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 30, field: 'interval_seconds' },
    startedAt: { type: DataTypes.DATE, allowNull: true, field: 'started_at' },
    stoppedAt: { type: DataTypes.DATE, allowNull: true, field: 'stopped_at' },
  },
  {
    sequelize,
    modelName: 'SimulationSetting',
    tableName: 'simulation_settings',
  },
);

module.exports = SimulationSetting;

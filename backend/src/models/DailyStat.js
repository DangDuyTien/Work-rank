const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class DailyStat extends Model {}

DailyStat.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    statDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'stat_date' },
    totalSeconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'total_seconds' },
    activeSeconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'active_seconds' },
    idleSeconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'idle_seconds' },
    focusScore: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'focus_score' },
    keystrokeCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'keystroke_count' },
    mouseClickCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'mouse_click_count' },
    sessionCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'session_count' },
    rankPosition: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'rank_position' },
  },
  {
    sequelize,
    modelName: 'DailyStat',
    tableName: 'daily_stats',
    indexes: [{ unique: true, fields: ['user_id', 'stat_date'] }],
  },
);

module.exports = DailyStat;

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class UserMinuteStat extends Model {}

UserMinuteStat.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    bucketStartAt: { type: DataTypes.DATE, allowNull: false, field: 'bucket_start_at' },
    statDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'stat_date' },
    totalSeconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'total_seconds' },
    activeSeconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'active_seconds' },
    idleSeconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'idle_seconds' },
    focusScore: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'focus_score' },
    keystrokeCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'keystroke_count' },
    mouseClickCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'mouse_click_count' },
    mouseMoveCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'mouse_move_count' },
    eventCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'event_count' },
  },
  {
    sequelize,
    modelName: 'UserMinuteStat',
    tableName: 'user_minute_stats',
    indexes: [
      { unique: true, fields: ['user_id', 'bucket_start_at'] },
      { fields: ['stat_date', 'user_id'] },
      { fields: ['bucket_start_at'] },
    ],
  },
);

module.exports = UserMinuteStat;

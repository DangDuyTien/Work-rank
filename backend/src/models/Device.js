const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Device extends Model {}

Device.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    deviceUuid: { type: DataTypes.STRING(191), allowNull: false, field: 'device_uuid' },
    deviceSecretHash: { type: DataTypes.STRING(191), allowNull: true, field: 'device_secret_hash' },
    deviceName: { type: DataTypes.STRING(191), allowNull: false, field: 'device_name' },
    platform: { type: DataTypes.ENUM('macos', 'windows', 'linux'), allowNull: false },
    appVersion: { type: DataTypes.STRING(50), allowNull: true, field: 'app_version' },
    lastSyncAt: { type: DataTypes.DATE, allowNull: true, field: 'last_sync_at' },
    lastSequence: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0, field: 'last_sequence' },
    lastEventAt: { type: DataTypes.DATE, allowNull: true, field: 'last_event_at' },
    lastClickCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'last_click_count' },
    lastActiveSeconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'last_active_seconds' },
    repeatedClickPatternCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'repeated_click_pattern_count' },
    clickOnlyStreakCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'click_only_streak_count' },
    revokedAt: { type: DataTypes.DATE, allowNull: true, field: 'revoked_at' },
  },
  {
    sequelize,
    modelName: 'Device',
    tableName: 'devices',
    indexes: [{ unique: true, fields: ['user_id', 'device_uuid'] }],
  },
);

module.exports = Device;

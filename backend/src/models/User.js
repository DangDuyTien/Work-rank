const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class User extends Model {}

User.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    email: { type: DataTypes.STRING(191), allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING(191), allowNull: false, field: 'password_hash' },
    refreshTokenHash: { type: DataTypes.STRING(191), allowNull: true, field: 'refresh_token_hash' },
    googleSub: { type: DataTypes.STRING(191), allowNull: true, unique: true, field: 'google_sub' },
    avatarUrl: { type: DataTypes.STRING(2048), allowNull: true, field: 'avatar_url' },
    tokenVersion: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'token_version' },
    role: { type: DataTypes.ENUM('admin', 'manager', 'user'), allowNull: false, defaultValue: 'user' },
    teamId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'team_id' },
    jobTitle: { type: DataTypes.STRING(120), allowNull: true, defaultValue: 'Nhân viên', field: 'job_title' },
    department: { type: DataTypes.STRING(120), allowNull: true, defaultValue: 'Media & Content', field: 'department' },
    departmentId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'department_id' },
    bio: { type: DataTypes.TEXT, allowNull: true },
    phone: { type: DataTypes.STRING(32), allowNull: true },
    isVerified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_verified' },
    isDev: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_dev' },
    isSimulated: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_simulated' },
    status: { type: DataTypes.ENUM('active', 'inactive'), allowNull: false, defaultValue: 'active' },
    profileStatus: { type: DataTypes.ENUM('incomplete', 'complete'), allowNull: false, defaultValue: 'complete', field: 'profile_status' },
    lastSeenAt: { type: DataTypes.DATE, allowNull: true, field: 'last_seen_at' },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    defaultScope: { attributes: { exclude: ['googleSub'] } },
  },
);

module.exports = User;

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class User extends Model {}

User.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    email: { type: DataTypes.STRING(191), allowNull: false, unique: true, validate: { isEmail: true } },
    passwordHash: { type: DataTypes.STRING(191), allowNull: false, field: 'password_hash' },
    refreshTokenHash: { type: DataTypes.STRING(191), allowNull: true, field: 'refresh_token_hash' },
    role: { type: DataTypes.ENUM('admin', 'manager', 'user'), allowNull: false, defaultValue: 'user' },
    teamId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'team_id' },
    isVerified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_verified' },
    status: { type: DataTypes.ENUM('active', 'inactive'), allowNull: false, defaultValue: 'active' },
    lastSeenAt: { type: DataTypes.DATE, allowNull: true, field: 'last_seen_at' },
  },
  { sequelize, modelName: 'User', tableName: 'users' },
);

module.exports = User;

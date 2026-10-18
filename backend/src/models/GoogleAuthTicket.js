const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class GoogleAuthTicket extends Model {}

GoogleAuthTicket.init(
  {
    tokenHash: { type: DataTypes.STRING(64), primaryKey: true, field: 'token_hash' },
    purpose: { type: DataTypes.STRING(16), allowNull: false },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    googleSub: { type: DataTypes.STRING(191), allowNull: false, field: 'google_sub' },
    googleEmail: { type: DataTypes.STRING(191), allowNull: false, field: 'google_email' },
    googleName: { type: DataTypes.STRING(120), allowNull: false, field: 'google_name' },
    googlePicture: { type: DataTypes.STRING(2048), allowNull: true, field: 'google_picture' },
    returnTo: { type: DataTypes.STRING(2048), allowNull: false, field: 'return_to' },
    expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
  },
  {
    sequelize,
    modelName: 'GoogleAuthTicket',
    tableName: 'google_auth_tickets',
    updatedAt: false,
  },
);

module.exports = GoogleAuthTicket;

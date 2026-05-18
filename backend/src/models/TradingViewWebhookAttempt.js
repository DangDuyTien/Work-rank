const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class TradingViewWebhookAttempt extends Model {}

TradingViewWebhookAttempt.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    receivedAt: { type: DataTypes.DATE, allowNull: false, field: 'received_at' },
    status: { type: DataTypes.STRING(16), allowNull: false },
    bodyBytes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'body_bytes' },
    symbol: { type: DataTypes.STRING(20), allowNull: true },
    timeframe: { type: DataTypes.STRING(10), allowNull: true },
    closed: { type: DataTypes.BOOLEAN, allowNull: true },
    error: { type: DataTypes.STRING(255), allowNull: true },
  },
  {
    sequelize,
    modelName: 'TradingViewWebhookAttempt',
    tableName: 'tradingview_webhook_attempts',
    timestamps: false,
  },
);

module.exports = TradingViewWebhookAttempt;

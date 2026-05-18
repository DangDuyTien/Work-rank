const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class TradingViewCandle extends Model {}

TradingViewCandle.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    symbol: { type: DataTypes.STRING(20), allowNull: false },
    timeframe: { type: DataTypes.STRING(10), allowNull: false },
    time: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    open: { type: DataTypes.DOUBLE, allowNull: false },
    high: { type: DataTypes.DOUBLE, allowNull: false },
    low: { type: DataTypes.DOUBLE, allowNull: false },
    close: { type: DataTypes.DOUBLE, allowNull: false },
    volume: { type: DataTypes.DOUBLE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'TradingViewCandle',
    tableName: 'tradingview_candles',
    indexes: [
      { unique: true, fields: ['symbol', 'timeframe', 'time'] },
    ],
  },
);

module.exports = TradingViewCandle;

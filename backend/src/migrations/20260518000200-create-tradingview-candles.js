'use strict';

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.some((table) => {
    const name = typeof table === 'string' ? table : table.tableName || table.name;
    return name === tableName;
  });
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, 'tradingview_candles'))) {
      await queryInterface.createTable('tradingview_candles', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        symbol: { type: Sequelize.STRING(20), allowNull: false },
        timeframe: { type: Sequelize.STRING(10), allowNull: false },
        time: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false },
        open: { type: Sequelize.DOUBLE, allowNull: false },
        high: { type: Sequelize.DOUBLE, allowNull: false },
        low: { type: Sequelize.DOUBLE, allowNull: false },
        close: { type: Sequelize.DOUBLE, allowNull: false },
        volume: { type: Sequelize.DOUBLE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });

      await queryInterface.addIndex('tradingview_candles', ['symbol', 'timeframe', 'time'], {
        unique: true,
        name: 'tradingview_candles_symbol_timeframe_time_unique',
      });
    }

    if (!(await tableExists(queryInterface, 'tradingview_webhook_attempts'))) {
      await queryInterface.createTable('tradingview_webhook_attempts', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        received_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        status: { type: Sequelize.STRING(16), allowNull: false },
        body_bytes: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
        symbol: { type: Sequelize.STRING(20), allowNull: true },
        timeframe: { type: Sequelize.STRING(10), allowNull: true },
        closed: { type: Sequelize.BOOLEAN, allowNull: true },
        error: { type: Sequelize.STRING(255), allowNull: true },
      });

      await queryInterface.addIndex('tradingview_webhook_attempts', ['received_at', 'id'], {
        name: 'tradingview_attempts_received_id_idx',
      });
    }
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, 'tradingview_webhook_attempts')) {
      await queryInterface.dropTable('tradingview_webhook_attempts');
    }
    if (await tableExists(queryInterface, 'tradingview_candles')) {
      await queryInterface.dropTable('tradingview_candles');
    }
  },
};

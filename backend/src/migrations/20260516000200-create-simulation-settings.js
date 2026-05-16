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
    if (await tableExists(queryInterface, 'simulation_settings')) return;

    await queryInterface.createTable('simulation_settings', {
      id: { type: Sequelize.TINYINT.UNSIGNED, allowNull: false, primaryKey: true },
      enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      target_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 50 },
      interval_seconds: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 30 },
      started_at: { type: Sequelize.DATE, allowNull: true },
      stopped_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, 'simulation_settings')) {
      await queryInterface.dropTable('simulation_settings');
    }
  },
};

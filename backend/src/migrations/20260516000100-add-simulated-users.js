'use strict';

async function columnExists(queryInterface, tableName, columnName) {
  const table = await queryInterface.describeTable(tableName);
  return Boolean(table[columnName]);
}

async function indexExists(queryInterface, tableName, indexName) {
  const indexes = await queryInterface.showIndex(tableName);
  return indexes.some((index) => index.name === indexName);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await columnExists(queryInterface, 'users', 'is_simulated'))) {
      await queryInterface.addColumn('users', 'is_simulated', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        after: 'is_verified',
      });
    }

    if (!(await indexExists(queryInterface, 'users', 'users_is_simulated_idx'))) {
      await queryInterface.addIndex('users', ['is_simulated'], {
        name: 'users_is_simulated_idx',
      });
    }
  },

  async down(queryInterface) {
    if (await indexExists(queryInterface, 'users', 'users_is_simulated_idx')) {
      await queryInterface.removeIndex('users', 'users_is_simulated_idx');
    }
    if (await columnExists(queryInterface, 'users', 'is_simulated')) {
      await queryInterface.removeColumn('users', 'is_simulated');
    }
  },
};

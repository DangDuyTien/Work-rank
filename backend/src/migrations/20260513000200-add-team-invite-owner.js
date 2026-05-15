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
    if (!(await columnExists(queryInterface, 'teams', 'invite_code'))) {
      await queryInterface.addColumn('teams', 'invite_code', {
        type: Sequelize.STRING(32),
        allowNull: true,
        after: 'description',
      });
    }
    if (!(await indexExists(queryInterface, 'teams', 'teams_invite_code_unique'))) {
      await queryInterface.addIndex('teams', ['invite_code'], {
        name: 'teams_invite_code_unique',
        unique: true,
      });
    }
    if (!(await columnExists(queryInterface, 'teams', 'owner_id'))) {
      await queryInterface.addColumn('teams', 'owner_id', {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        after: 'invite_code',
      });
    }
  },

  async down(queryInterface) {
    if (await columnExists(queryInterface, 'teams', 'owner_id')) {
      await queryInterface.removeColumn('teams', 'owner_id');
    }
    if (await indexExists(queryInterface, 'teams', 'teams_invite_code_unique')) {
      await queryInterface.removeIndex('teams', 'teams_invite_code_unique');
    }
    if (await columnExists(queryInterface, 'teams', 'invite_code')) {
      await queryInterface.removeColumn('teams', 'invite_code');
    }
  },
};

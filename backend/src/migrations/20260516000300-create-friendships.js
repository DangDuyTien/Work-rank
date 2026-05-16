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
    if (await tableExists(queryInterface, 'friendships')) return;

    await queryInterface.createTable('friendships', {
      id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      requester_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      addressee_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      status: {
        type: Sequelize.ENUM('pending', 'accepted', 'declined'),
        allowNull: false,
        defaultValue: 'pending',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('friendships', ['requester_id'], { name: 'friendships_requester_idx' });
    await queryInterface.addIndex('friendships', ['addressee_id'], { name: 'friendships_addressee_idx' });
    await queryInterface.addIndex('friendships', ['status'], { name: 'friendships_status_idx' });
    await queryInterface.addIndex('friendships', ['requester_id', 'addressee_id'], {
      unique: true,
      name: 'friendships_pair_unique',
    });
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, 'friendships')) {
      await queryInterface.dropTable('friendships');
    }
  },
};

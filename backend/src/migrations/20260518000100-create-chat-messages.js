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
    if (await tableExists(queryInterface, 'chat_messages')) return;

    await queryInterface.createTable('chat_messages', {
      id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      sender_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      receiver_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      body: { type: Sequelize.TEXT, allowNull: false },
      client_message_id: { type: Sequelize.STRING(80), allowNull: true },
      read_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('chat_messages', ['sender_id', 'receiver_id', 'id'], {
      name: 'chat_messages_sender_receiver_id_idx',
    });
    await queryInterface.addIndex('chat_messages', ['receiver_id', 'sender_id', 'id'], {
      name: 'chat_messages_receiver_sender_id_idx',
    });
    await queryInterface.addIndex('chat_messages', ['receiver_id', 'read_at', 'id'], {
      name: 'chat_messages_receiver_read_id_idx',
    });
    await queryInterface.addIndex('chat_messages', ['sender_id', 'client_message_id'], {
      unique: true,
      name: 'chat_messages_sender_client_unique',
    });
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, 'chat_messages')) {
      await queryInterface.dropTable('chat_messages');
    }
  },
};

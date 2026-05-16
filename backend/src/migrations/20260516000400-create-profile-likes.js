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
    if (await tableExists(queryInterface, 'profile_likes')) return;

    await queryInterface.createTable('profile_likes', {
      id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      liker_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      target_user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      liked_date: { type: Sequelize.DATEONLY, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('profile_likes', ['target_user_id'], { name: 'profile_likes_target_idx' });
    await queryInterface.addIndex('profile_likes', ['liker_id'], { name: 'profile_likes_liker_idx' });
    await queryInterface.addIndex('profile_likes', ['liked_date'], { name: 'profile_likes_date_idx' });
    await queryInterface.addIndex('profile_likes', ['liker_id', 'target_user_id', 'liked_date'], {
      unique: true,
      name: 'profile_likes_daily_unique',
    });
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, 'profile_likes')) {
      await queryInterface.dropTable('profile_likes');
    }
  },
};

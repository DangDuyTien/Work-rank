'use strict';
module.exports = {
  async up(q, S) {
    const dialect = q.sequelize.getDialect();
    if (dialect === 'postgres') await q.sequelize.query('ALTER TYPE "enum_typing_rooms_mode" ADD VALUE IF NOT EXISTS \'TRIO\'');
    if (dialect === 'mysql' || dialect === 'mariadb') {
      const columns = await q.describeTable('typing_rooms');
      if (!String(columns.mode.type).includes('TRIO')) await q.changeColumn('typing_rooms', 'mode', { type: S.ENUM('SOLO', '1V1', 'TRIO', '2V2', '3V3'), allowNull: false, defaultValue: '1V1' });
    }
    // SQLite stores Sequelize ENUM as TEXT; the model already accepts TRIO.
  },
};

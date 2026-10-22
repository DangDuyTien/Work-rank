'use strict';
module.exports = {
  async up(q, S) {
    const dialect = q.sequelize.getDialect();
    for (const table of ['typing_rooms', 'typing_match_results']) {
      if (dialect === 'postgres') await q.sequelize.query(`ALTER TYPE "enum_${table}_mode" ADD VALUE IF NOT EXISTS 'TRIO'`);
      if (dialect === 'mysql' || dialect === 'mariadb') {
        const columns = await q.describeTable(table);
        if (!String(columns.mode.type).includes('TRIO')) await q.changeColumn(table, 'mode', { type: S.ENUM('SOLO','1V1','TRIO','2V2','3V3'), allowNull: false, defaultValue: '1V1' });
      }
    }
  },
};

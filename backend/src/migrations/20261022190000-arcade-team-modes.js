'use strict';

/**
 * Arcade team modes.
 *
 * - `DUO` (tên cũ) được đổi thành `1V1` để nhãn khớp đúng số người.
 * - Thêm cột `team` cho 2V2/3V3; các mode cũ giữ NULL.
 * - Backfill team cho phòng đội đã tồn tại (nếu có) theo thứ tự vào phòng.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes: D } = Sequelize;
    const tables = await queryInterface.showAllTables();
    const has = (name) => tables.map((table) => (typeof table === 'string' ? table : table.tableName)).includes(name);
    if (!has('arcade_players')) return;

    const columns = await queryInterface.describeTable('arcade_players');
    if (!columns.team) await queryInterface.addColumn('arcade_players', 'team', { type: D.STRING(1), allowNull: true });

    if (has('arcade_rooms')) await queryInterface.sequelize.query("UPDATE arcade_rooms SET mode = '1V1' WHERE mode = 'DUO'");

    const [rooms] = await queryInterface.sequelize.query("SELECT id, mode FROM arcade_rooms WHERE mode IN ('2V2', '3V3')");
    for (const room of rooms) {
      const [players] = await queryInterface.sequelize.query(
        'SELECT id FROM arcade_players WHERE room_id = ? AND team IS NULL ORDER BY created_at ASC, id ASC',
        { replacements: [room.id] },
      );
      for (let index = 0; index < players.length; index++) {
        await queryInterface.sequelize.query('UPDATE arcade_players SET team = ? WHERE id = ?', {
          replacements: [index % 2 === 0 ? 'A' : 'B', players[index].id],
        });
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query("UPDATE arcade_rooms SET mode = 'DUO' WHERE mode = '1V1'");
    const columns = await queryInterface.describeTable('arcade_players');
    if (columns.team) await queryInterface.removeColumn('arcade_players', 'team');
  },
};

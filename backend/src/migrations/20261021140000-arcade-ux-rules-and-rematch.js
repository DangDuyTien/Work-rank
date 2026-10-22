'use strict';
module.exports = {
  async up(q, S) {
    const columns = await q.describeTable('arcade_rooms');
    // Existing attempts retain their original generator and scoring contract.
    if (!columns.rules_version) await q.addColumn('arcade_rooms', 'rules_version', { type: S.INTEGER, allowNull: false, defaultValue: 1 });
    if (!columns.rematch_id) await q.addColumn('arcade_rooms', 'rematch_id', { type: S.STRING(36), allowNull: true });
  },
  async down(q) { await q.removeColumn('arcade_rooms', 'rematch_id'); await q.removeColumn('arcade_rooms', 'rules_version'); },
};

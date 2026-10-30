'use strict';

// Additive rollout: the old volume column remains unused for rollback safety.
// No application model, command, snapshot or event reads/writes that column.
module.exports = {
  async up(q, S) {
    const sessions = await q.describeTable('private_media_sessions');
    const columns = {
      revision: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
      reference_time: { type: S.DATE, allowNull: true },
      current_queue_item_id: { type: S.STRING(36), allowNull: true },
      last_failure: { type: S.JSON, allowNull: true },
    };
    for (const [name, spec] of Object.entries(columns)) {
      if (!sessions[name]) await q.addColumn('private_media_sessions', name, spec);
    }
    const grants = await q.describeTable('private_media_grants');
    if (!grants.can_queue) await q.addColumn('private_media_grants', 'can_queue', { type: S.BOOLEAN, allowNull: false, defaultValue: false });
  },
  async down(q) {
    for (const name of ['revision', 'reference_time', 'current_queue_item_id', 'last_failure']) {
      if ((await q.describeTable('private_media_sessions'))[name]) await q.removeColumn('private_media_sessions', name);
    }
    if ((await q.describeTable('private_media_grants')).can_queue) await q.removeColumn('private_media_grants', 'can_queue');
  },
};

'use strict';

/**
 * Chat read markers (one row per playback session + user).
 *
 * Root cause it fixes: unread was React state only. Navigating away from the
 * media page dropped the counter, refreshing lost it, and a reconnect could not
 * tell "already read" from "never seen". The marker is now stored server-side
 * and only moves forward.
 */
module.exports = {
  async up(q, S) {
    const tables = (await q.showAllTables()).map((entry) => (typeof entry === 'string' ? entry : entry.tableName));
    if (tables.includes('private_media_chat_reads')) return;

    await q.createTable('private_media_chat_reads', {
      id: { type: S.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, allowNull: false },
      session_id: { type: S.BIGINT.UNSIGNED, allowNull: false },
      user_id: { type: S.BIGINT.UNSIGNED, allowNull: false },
      last_read_message_id: { type: S.BIGINT.UNSIGNED, allowNull: true },
      created_at: { type: S.DATE, allowNull: false },
      updated_at: { type: S.DATE, allowNull: false },
    });
    await q.addIndex('private_media_chat_reads', ['session_id', 'user_id'], {
      unique: true,
      name: 'pm_chat_read_unique',
    });
  },

  async down(q) {
    await q.dropTable('private_media_chat_reads');
  },
};

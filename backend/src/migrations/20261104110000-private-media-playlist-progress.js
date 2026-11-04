'use strict';

/** Playlist resume bookmarks (one row per playlist + user). */
module.exports = {
  async up(q, S) {
    const tables = (await q.showAllTables()).map((entry) => (typeof entry === 'string' ? entry : entry.tableName));
    if (tables.includes('private_media_playlist_progress')) return;

    await q.createTable('private_media_playlist_progress', {
      id: { type: S.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, allowNull: false },
      playlist_id: { type: S.BIGINT.UNSIGNED, allowNull: false },
      user_id: { type: S.BIGINT.UNSIGNED, allowNull: false },
      item_id: { type: S.BIGINT.UNSIGNED, allowNull: true },
      video_id: { type: S.STRING(16), allowNull: true },
      episode_number: { type: S.INTEGER, allowNull: true },
      updated_at: { type: S.DATE, allowNull: true },
    });
    await q.addIndex('private_media_playlist_progress', ['playlist_id', 'user_id'], { unique: true, name: 'pm_progress_unique' });
  },

  async down(q) {
    await q.dropTable('private_media_playlist_progress');
  },
};

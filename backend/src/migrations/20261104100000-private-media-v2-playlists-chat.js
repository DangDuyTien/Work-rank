'use strict';

/**
 * PRIVATE MEDIA V2 — playlists, chat and playlist playback state.
 *
 * Additive only. Every column/table is guarded with `describeTable` so the
 * migration can be re-run against a database that was partially upgraded.
 */

const PLAYLIST_TABLE = 'private_media_playlists';
const ITEM_TABLE = 'private_media_playlist_items';
const CHAT_TABLE = 'private_media_chat_messages';

module.exports = {
  async up(q, S) {
    // MySQL returns names, SQLite returns objects — normalise both.
    const tables = (await q.showAllTables()).map((entry) => (typeof entry === 'string' ? entry : entry.tableName));

    if (!tables.includes(PLAYLIST_TABLE)) {
      await q.createTable(PLAYLIST_TABLE, {
        id: { type: S.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, allowNull: false },
        owner_user_id: { type: S.BIGINT.UNSIGNED, allowNull: true },
        slug: { type: S.STRING(64), allowNull: true, unique: true },
        title: { type: S.STRING(191), allowNull: false },
        description: { type: S.STRING(512), allowNull: true },
        kind: { type: S.STRING(16), allowNull: false, defaultValue: 'user' },
        visibility: { type: S.STRING(16), allowNull: false, defaultValue: 'private' },
        playback_mode: { type: S.STRING(16), allowNull: false, defaultValue: 'sequential' },
        repeat_mode: { type: S.STRING(16), allowNull: false, defaultValue: 'off' },
        source_type: { type: S.STRING(16), allowNull: false, defaultValue: 'manual' },
        source_playlist_id: { type: S.STRING(64), allowNull: true },
        source_channel: { type: S.STRING(191), allowNull: true },
        source_url: { type: S.STRING(512), allowNull: true },
        cover_url: { type: S.STRING(512), allowNull: true },
        item_count: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
        expected_count: { type: S.INTEGER, allowNull: true },
        verified_at: { type: S.DATE, allowNull: true },
        created_at: { type: S.DATE, allowNull: false },
        updated_at: { type: S.DATE, allowNull: false },
      });
      await q.addIndex(PLAYLIST_TABLE, ['kind', 'visibility']);
      await q.addIndex(PLAYLIST_TABLE, ['owner_user_id']);
    }

    if (!tables.includes(ITEM_TABLE)) {
      await q.createTable(ITEM_TABLE, {
        id: { type: S.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, allowNull: false },
        playlist_id: { type: S.BIGINT.UNSIGNED, allowNull: false },
        video_id: { type: S.STRING(16), allowNull: false },
        title: { type: S.STRING(255), allowNull: true },
        channel_title: { type: S.STRING(191), allowNull: true },
        thumbnail_url: { type: S.STRING(512), allowNull: true },
        duration_seconds: { type: S.INTEGER, allowNull: true },
        episode_number: { type: S.INTEGER, allowNull: true },
        position: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
        available: { type: S.BOOLEAN, allowNull: false, defaultValue: true },
        unavailable_reason: { type: S.STRING(32), allowNull: true },
        added_by_user_id: { type: S.BIGINT.UNSIGNED, allowNull: true },
        created_at: { type: S.DATE, allowNull: false },
        updated_at: { type: S.DATE, allowNull: false },
      });
      await q.addIndex(ITEM_TABLE, ['playlist_id', 'position']);
      await q.addIndex(ITEM_TABLE, ['playlist_id', 'video_id']);
    }

    if (!tables.includes(CHAT_TABLE)) {
      await q.createTable(CHAT_TABLE, {
        id: { type: S.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, allowNull: false },
        session_id: { type: S.BIGINT.UNSIGNED, allowNull: false },
        user_id: { type: S.BIGINT.UNSIGNED, allowNull: false },
        content: { type: S.STRING(1000), allowNull: false },
        client_message_id: { type: S.STRING(64), allowNull: true },
        deleted_at: { type: S.DATE, allowNull: true },
        created_at: { type: S.DATE, allowNull: false },
      });
      await q.addIndex(CHAT_TABLE, ['session_id', 'id']);
      await q.addIndex(CHAT_TABLE, ['session_id', 'user_id', 'client_message_id'], { unique: true, name: 'pm_chat_dedupe' });
    }

    const sessions = await q.describeTable('private_media_sessions');
    const columns = {
      active_playlist_id: { type: S.BIGINT.UNSIGNED, allowNull: true },
      playlist_title: { type: S.STRING(191), allowNull: true },
      playlist_mode: { type: S.STRING(16), allowNull: true },
      playlist_repeat: { type: S.STRING(16), allowNull: true },
      playlist_order: { type: S.JSON, allowNull: true },
      playlist_cursor: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
      playlist_history: { type: S.JSON, allowNull: true },
    };
    for (const [name, spec] of Object.entries(columns)) {
      if (!sessions[name]) await q.addColumn('private_media_sessions', name, spec);
    }
  },

  async down(q) {
    for (const name of ['active_playlist_id', 'playlist_title', 'playlist_mode', 'playlist_repeat', 'playlist_order', 'playlist_cursor', 'playlist_history']) {
      const sessions = await q.describeTable('private_media_sessions');
      if (sessions[name]) await q.removeColumn('private_media_sessions', name);
    }
    await q.dropTable(CHAT_TABLE);
    await q.dropTable(ITEM_TABLE);
    await q.dropTable(PLAYLIST_TABLE);
  },
};

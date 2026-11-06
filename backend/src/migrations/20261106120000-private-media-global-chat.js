'use strict';

/**
 * PRIVATE MEDIA — GLOBAL CHAT CHANNEL
 *
 * Chat used to be scoped to one playback session: a message written while in
 * "Nghe riêng" lived in that account's private session and could never be seen
 * by anybody else. The product requirement is the opposite — one system-wide
 * feed, identical in both listening modes, showing only the current Vietnam day.
 *
 * This migration is additive and non-destructive:
 *   - `channel` (default 'session') marks every pre-existing row as legacy, so
 *     old private conversations are NEVER merged into the public feed
 *   - `day` ('YYYY-MM-DD' in Asia/Ho_Chi_Minh) is stamped by the server, which
 *     makes "today only" an indexed equality instead of a timezone calculation
 *   - messages that were already public (written in the shared room) are
 *     promoted to the global channel for the day they were written, so nobody
 *     loses today's conversation at deploy time
 *   - nothing is deleted: yesterday's rows stay in the table forever
 */

const { QueryTypes } = require('sequelize');
const chatTime = require('../services/privateMedia/chatTime');

const TABLE = 'private_media_chat_messages';
const SESSION_TABLE = 'private_media_sessions';
const INDEX_NAME = 'pm_chat_channel_day_id';

async function tableNames(q) {
  return (await q.showAllTables()).map((entry) => (typeof entry === 'string' ? entry : entry.tableName));
}

async function indexNames(q) {
  try {
    const rows = await q.showIndex(TABLE);
    return new Set(rows.map((row) => row.name));
  } catch {
    return new Set();
  }
}

/**
 * Promote only the shared-room messages (already visible to every listener) to
 * the global channel. Private-session rows keep `channel = 'session'`.
 */
async function promoteSharedRoomMessages(q) {
  const sequelize = q.sequelize;
  const shared = await sequelize.query(
    `SELECT id FROM ${SESSION_TABLE} WHERE session_key = 'room:shared' LIMIT 1`,
    { type: QueryTypes.SELECT },
  );
  const sessionId = Number(shared?.[0]?.id);
  if (!sessionId) return 0;

  const rows = await sequelize.query(
    `SELECT id, created_at FROM ${TABLE} WHERE session_id = :sessionId AND channel = 'session'`,
    { replacements: { sessionId }, type: QueryTypes.SELECT },
  );
  if (!rows.length) return 0;

  const byDay = new Map();
  for (const row of rows) {
    const day = chatTime.dayKey(row.created_at);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(Number(row.id));
  }

  for (const [day, ids] of byDay) {
    await sequelize.query(
      `UPDATE ${TABLE} SET channel = 'global', day = :day WHERE id IN (:ids)`,
      { replacements: { day, ids }, type: QueryTypes.UPDATE },
    );
  }
  return rows.length;
}

module.exports = {
  async up(q, S) {
    if (!(await tableNames(q)).includes(TABLE)) return;

    const columns = await q.describeTable(TABLE);
    if (!columns.channel) {
      await q.addColumn(TABLE, 'channel', {
        type: S.STRING(32),
        allowNull: false,
        defaultValue: 'session',
      });
    }
    if (!columns.day) {
      await q.addColumn(TABLE, 'day', {
        type: S.STRING(10),
        allowNull: false,
        defaultValue: '1970-01-01',
      });
    }

    const names = await indexNames(q);
    if (!names.has(INDEX_NAME)) {
      await q.addIndex(TABLE, ['channel', 'day', 'id'], { name: INDEX_NAME });
    }

    await promoteSharedRoomMessages(q);
  },

  async down(q) {
    const names = await indexNames(q);
    if (names.has(INDEX_NAME)) await q.removeIndex(TABLE, INDEX_NAME);
    const columns = await q.describeTable(TABLE);
    if (columns.day) await q.removeColumn(TABLE, 'day');
    if (columns.channel) await q.removeColumn(TABLE, 'channel');
  },
};

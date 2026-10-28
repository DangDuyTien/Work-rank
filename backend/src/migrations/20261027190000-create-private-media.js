'use strict';

/**
 * PRIVATE MEDIA — isolated capability tables.
 *
 * This module is deliberately separate from role-based permissions:
 * `users.role` (admin / manager / user) is never consulted by Private Media.
 * Authorization comes from `private_media_owners` (bootstrap root owner) or an
 * explicit, non-revoked row in `private_media_grants`.
 *
 * Secrets policy: only SHA-256 hashes of device tokens / pairing codes are
 * stored. Plaintext never touches the database.
 */

const OWNER_TABLE = 'private_media_owners';
const GRANT_TABLE = 'private_media_grants';
const DEVICE_TABLE = 'private_media_devices';
const TELEGRAM_TABLE = 'private_media_telegram_bindings';
const PAIRING_TABLE = 'private_media_pairing_codes';
const SESSION_TABLE = 'private_media_sessions';
const COMMAND_TABLE = 'private_media_commands';
const AUDIT_TABLE = 'private_media_audit_logs';

async function hasTable(q, table) {
  return Boolean(await q.describeTable(table).catch(() => null));
}

module.exports = {
  async up(q, S) {
    if (!await hasTable(q, OWNER_TABLE)) {
      await q.createTable(OWNER_TABLE, {
        id: { type: S.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        user_id: {
          type: S.BIGINT.UNSIGNED,
          allowNull: false,
          unique: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
        },
        bootstrap_email: { type: S.STRING(191), allowNull: false },
        created_at: { type: S.DATE, allowNull: false },
        updated_at: { type: S.DATE, allowNull: false },
      });
    }

    if (!await hasTable(q, GRANT_TABLE)) {
      await q.createTable(GRANT_TABLE, {
        id: { type: S.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        user_id: {
          type: S.BIGINT.UNSIGNED,
          allowNull: false,
          unique: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
        },
        granted_by_user_id: {
          type: S.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
        },
        can_view: { type: S.BOOLEAN, allowNull: false, defaultValue: true },
        can_control: { type: S.BOOLEAN, allowNull: false, defaultValue: false },
        can_telegram: { type: S.BOOLEAN, allowNull: false, defaultValue: false },
        can_hotkey: { type: S.BOOLEAN, allowNull: false, defaultValue: false },
        note: { type: S.STRING(191), allowNull: true },
        created_at: { type: S.DATE, allowNull: false },
        updated_at: { type: S.DATE, allowNull: false },
        revoked_at: { type: S.DATE, allowNull: true },
      });
      await q.addIndex(GRANT_TABLE, ['revoked_at']);
    }

    if (!await hasTable(q, DEVICE_TABLE)) {
      await q.createTable(DEVICE_TABLE, {
        id: { type: S.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        user_id: {
          type: S.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
        },
        name: { type: S.STRING(120), allowNull: false },
        platform: { type: S.STRING(32), allowNull: false, defaultValue: 'macos' },
        token_hash: { type: S.STRING(64), allowNull: false, unique: true },
        token_prefix: { type: S.STRING(16), allowNull: false },
        created_at: { type: S.DATE, allowNull: false },
        updated_at: { type: S.DATE, allowNull: false },
        last_seen_at: { type: S.DATE, allowNull: true },
        revoked_at: { type: S.DATE, allowNull: true },
      });
      await q.addIndex(DEVICE_TABLE, ['user_id', 'revoked_at']);
    }

    if (!await hasTable(q, TELEGRAM_TABLE)) {
      await q.createTable(TELEGRAM_TABLE, {
        id: { type: S.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        user_id: {
          type: S.BIGINT.UNSIGNED,
          allowNull: false,
          unique: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
        },
        telegram_user_id: { type: S.STRING(32), allowNull: false },
        telegram_chat_id: { type: S.STRING(32), allowNull: false },
        telegram_username: { type: S.STRING(120), allowNull: true },
        created_at: { type: S.DATE, allowNull: false },
        updated_at: { type: S.DATE, allowNull: false },
        revoked_at: { type: S.DATE, allowNull: true },
      });
      await q.addIndex(TELEGRAM_TABLE, ['telegram_user_id', 'revoked_at']);
    }

    if (!await hasTable(q, PAIRING_TABLE)) {
      await q.createTable(PAIRING_TABLE, {
        id: { type: S.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        code_hash: { type: S.STRING(64), allowNull: false, unique: true },
        purpose: { type: S.STRING(16), allowNull: false },
        user_id: {
          type: S.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
        },
        label: { type: S.STRING(120), allowNull: true },
        created_at: { type: S.DATE, allowNull: false },
        updated_at: { type: S.DATE, allowNull: false },
        expires_at: { type: S.DATE, allowNull: false },
        used_at: { type: S.DATE, allowNull: true },
      });
      await q.addIndex(PAIRING_TABLE, ['user_id', 'purpose']);
    }

    if (!await hasTable(q, SESSION_TABLE)) {
      await q.createTable(SESSION_TABLE, {
        id: { type: S.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        session_key: { type: S.STRING(32), allowNull: false, unique: true },
        status: { type: S.STRING(16), allowNull: false, defaultValue: 'IDLE' },
        current_video_id: { type: S.STRING(32), allowNull: true },
        title: { type: S.STRING(255), allowNull: true },
        channel_title: { type: S.STRING(191), allowNull: true },
        thumbnail_url: { type: S.STRING(512), allowNull: true },
        duration_seconds: { type: S.INTEGER, allowNull: true },
        current_time: { type: S.DOUBLE, allowNull: false, defaultValue: 0 },
        volume: { type: S.INTEGER, allowNull: false, defaultValue: 100 },
        queue: { type: S.JSON, allowNull: true },
        queue_index: { type: S.INTEGER, allowNull: false, defaultValue: -1 },
        controller_user_id: { type: S.BIGINT.UNSIGNED, allowNull: true },
        player_online: { type: S.BOOLEAN, allowNull: false, defaultValue: false },
        player_last_seen_at: { type: S.DATE, allowNull: true },
        created_at: { type: S.DATE, allowNull: false },
        updated_at: { type: S.DATE, allowNull: false },
      });
    }

    if (!await hasTable(q, COMMAND_TABLE)) {
      await q.createTable(COMMAND_TABLE, {
        id: { type: S.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        command_id: { type: S.STRING(64), allowNull: false, unique: true },
        session_id: { type: S.BIGINT.UNSIGNED, allowNull: true },
        action: { type: S.STRING(32), allowNull: false },
        source: { type: S.STRING(16), allowNull: false },
        issued_by_user_id: { type: S.BIGINT.UNSIGNED, allowNull: true },
        payload: { type: S.JSON, allowNull: true },
        status: { type: S.STRING(16), allowNull: false, defaultValue: 'QUEUED' },
        error_code: { type: S.STRING(64), allowNull: true },
        created_at: { type: S.DATE, allowNull: false },
        updated_at: { type: S.DATE, allowNull: false },
        executed_at: { type: S.DATE, allowNull: true },
      });
      await q.addIndex(COMMAND_TABLE, ['session_id', 'created_at']);
    }

    if (!await hasTable(q, AUDIT_TABLE)) {
      await q.createTable(AUDIT_TABLE, {
        id: { type: S.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        action: { type: S.STRING(48), allowNull: false },
        actor_user_id: { type: S.BIGINT.UNSIGNED, allowNull: true },
        target_user_id: { type: S.BIGINT.UNSIGNED, allowNull: true },
        source: { type: S.STRING(16), allowNull: false, defaultValue: 'WEB' },
        metadata: { type: S.JSON, allowNull: true },
        created_at: { type: S.DATE, allowNull: false },
        updated_at: { type: S.DATE, allowNull: false },
      });
      await q.addIndex(AUDIT_TABLE, ['action', 'created_at']);
      await q.addIndex(AUDIT_TABLE, ['actor_user_id', 'created_at']);
    }
  },

  async down(q) {
    for (const table of [AUDIT_TABLE, COMMAND_TABLE, SESSION_TABLE, PAIRING_TABLE, TELEGRAM_TABLE, DEVICE_TABLE, GRANT_TABLE, OWNER_TABLE]) {
      if (await hasTable(q, table)) await q.dropTable(table);
    }
  },
};

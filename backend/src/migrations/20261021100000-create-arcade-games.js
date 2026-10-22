'use strict';
module.exports = {
  async up(q, S) {
    if (!await q.describeTable('arcade_rooms').catch(() => null)) {
      await q.createTable('arcade_rooms', {
        id: { type: S.STRING(36), primaryKey: true }, game_type: { type: S.STRING(32), allowNull: false }, mode: { type: S.STRING(8), allowNull: false }, capacity: { type: S.INTEGER, allowNull: false },
        host_id: { type: S.BIGINT.UNSIGNED, allowNull: false }, title: { type: S.STRING(100), allowNull: false }, status: { type: S.STRING(16), allowNull: false, defaultValue: 'WAITING' },
        seed: { type: S.STRING(64), allowNull: false }, difficulty: { type: S.STRING(16), allowNull: false, defaultValue: 'mixed' }, duration_seconds: { type: S.INTEGER, allowNull: false, defaultValue: 60 },
        started_at: { type: S.DATE }, revision: { type: S.INTEGER, allowNull: false, defaultValue: 0 }, created_at: { type: S.DATE, allowNull: false }, updated_at: { type: S.DATE, allowNull: false },
      });
      await q.addIndex('arcade_rooms', ['game_type', 'status', 'mode']);
    }
    if (!await q.describeTable('arcade_players').catch(() => null)) {
      await q.createTable('arcade_players', {
        id: { type: S.STRING(36), primaryKey: true }, room_id: { type: S.STRING(36), allowNull: false, references: { model: 'arcade_rooms', key: 'id' }, onDelete: 'CASCADE' },
        user_id: { type: S.BIGINT.UNSIGNED, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' }, ready: { type: S.BOOLEAN, allowNull: false, defaultValue: false },
        revision: { type: S.INTEGER, allowNull: false, defaultValue: 0 }, events: { type: S.JSON, allowNull: false }, heartbeat_at: { type: S.DATE, allowNull: false }, finished_at: { type: S.DATE }, result: { type: S.JSON },
        created_at: { type: S.DATE, allowNull: false }, updated_at: { type: S.DATE, allowNull: false },
      });
      await q.addIndex('arcade_players', ['room_id', 'user_id'], { unique: true });
      await q.addIndex('arcade_players', ['user_id', 'finished_at']);
    }
  },
  async down(q) { await q.dropTable('arcade_players'); await q.dropTable('arcade_rooms'); },
};

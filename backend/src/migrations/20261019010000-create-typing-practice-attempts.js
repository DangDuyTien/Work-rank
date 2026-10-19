'use strict';
module.exports = {
  async up(q, S) {
    if (await q.describeTable('typing_practice_attempts').catch(() => null)) return;
    await q.createTable('typing_practice_attempts', {
      id: { type: S.STRING(36), primaryKey: true },
      user_id: { type: S.BIGINT.UNSIGNED, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      status: { type: S.STRING(16), allowNull: false, defaultValue: 'READY' },
      duration_seconds: { type: S.INTEGER, allowNull: false },
      challenge_text: { type: S.TEXT('long'), allowNull: false },
      typed_text: { type: S.TEXT('long'), allowNull: false },
      input_revision: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
      started_at: { type: S.DATE, allowNull: true }, finished_at: { type: S.DATE, allowNull: true }, result: { type: S.JSON, allowNull: true },
      created_at: { type: S.DATE, allowNull: false }, updated_at: { type: S.DATE, allowNull: false },
    });
    await q.addIndex('typing_practice_attempts', ['user_id', 'status']);
  },
  async down(q) { await q.dropTable('typing_practice_attempts'); },
};

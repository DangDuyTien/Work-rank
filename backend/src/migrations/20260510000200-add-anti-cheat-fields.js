'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('devices', 'device_secret_hash', { type: Sequelize.STRING(191), allowNull: true, after: 'device_uuid' });
    await queryInterface.addColumn('devices', 'last_sequence', { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0, after: 'last_sync_at' });
    await queryInterface.addColumn('devices', 'revoked_at', { type: Sequelize.DATE, allowNull: true, after: 'last_sequence' });

    await queryInterface.addColumn('activity_events', 'sequence', { type: Sequelize.BIGINT.UNSIGNED, allowNull: true, after: 'event_time' });
    await queryInterface.addColumn('activity_events', 'signature_valid', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false, after: 'sequence' });
    await queryInterface.addColumn('activity_events', 'suspicion_score', { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, after: 'signature_valid' });
    await queryInterface.addColumn('activity_events', 'flags_json', { type: Sequelize.JSON, allowNull: true, after: 'suspicion_score' });
    await queryInterface.addIndex('activity_events', ['device_id', 'sequence']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('activity_events', ['device_id', 'sequence']);
    await queryInterface.removeColumn('activity_events', 'flags_json');
    await queryInterface.removeColumn('activity_events', 'suspicion_score');
    await queryInterface.removeColumn('activity_events', 'signature_valid');
    await queryInterface.removeColumn('activity_events', 'sequence');
    await queryInterface.removeColumn('devices', 'revoked_at');
    await queryInterface.removeColumn('devices', 'last_sequence');
    await queryInterface.removeColumn('devices', 'device_secret_hash');
  },
};

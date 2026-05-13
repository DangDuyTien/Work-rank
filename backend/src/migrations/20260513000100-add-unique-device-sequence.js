'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex('activity_events', ['device_id', 'sequence'], {
      name: 'activity_events_device_sequence_unique',
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('activity_events', 'activity_events_device_sequence_unique');
  },
};

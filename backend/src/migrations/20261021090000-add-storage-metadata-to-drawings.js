'use strict';

/**
 * Thêm metadata lưu trữ cho ảnh Drawing để chuyển khỏi local `/uploads`.
 *
 * - storage_key      : object key trong persistent storage (dùng để delete/migrate)
 * - storage_provider : 's3' | 'local' | 'external' | NULL (legacy)
 * - mime_type        : định dạng thật đã xác thực ở server
 * - size_bytes       : dung lượng object
 *
 * Idempotent: kiểm tra cột tồn tại trước khi thêm (chạy lại không lỗi).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('drawings').catch(() => null);
    if (!table) return;

    if (!table.storage_key) {
      await queryInterface.addColumn('drawings', 'storage_key', {
        type: Sequelize.STRING(512),
        allowNull: true,
      });
    }
    if (!table.storage_provider) {
      await queryInterface.addColumn('drawings', 'storage_provider', {
        type: Sequelize.STRING(32),
        allowNull: true,
      });
    }
    if (!table.mime_type) {
      await queryInterface.addColumn('drawings', 'mime_type', {
        type: Sequelize.STRING(64),
        allowNull: true,
      });
    }
    if (!table.size_bytes) {
      await queryInterface.addColumn('drawings', 'size_bytes', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
      });
    }

    // Tra cứu nhanh các bản ghi legacy cần migrate (storage_key IS NULL)
    const indexes = await queryInterface.showIndex('drawings').catch(() => []);
    const hasStorageIndex = (indexes || []).some(
      (idx) => idx.name === 'drawings_storage_key' || (idx.fields || []).some((f) => f.attribute === 'storage_key')
    );
    if (!hasStorageIndex) {
      await queryInterface.addIndex('drawings', ['storage_key'], {
        name: 'drawings_storage_key',
      }).catch(() => {});
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('drawings').catch(() => null);
    if (!table) return;
    for (const column of ['storage_key', 'storage_provider', 'mime_type', 'size_bytes']) {
      if (table[column]) {
        await queryInterface.removeColumn('drawings', column).catch(() => {});
      }
    }
  },
};

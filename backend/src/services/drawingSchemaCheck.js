'use strict';

const fs = require('fs');
const path = require('path');
const { DataTypes } = require('sequelize');
const { Drawing, DrawingLike } = require('../models');
const { resolveStorageConfig } = require('../config/storage');

const STORAGE_COLUMNS = Object.freeze([
  { name: 'storage_key', definition: { type: DataTypes.STRING(512), allowNull: true } },
  { name: 'storage_provider', definition: { type: DataTypes.STRING(32), allowNull: true } },
  { name: 'mime_type', definition: { type: DataTypes.STRING(64), allowNull: true } },
  { name: 'size_bytes', definition: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true } },
]);

/**
 * Tự chữa schema Drawing + đảm bảo thư mục upload local chỉ tồn tại ở dev.
 *
 * Production dùng object storage nên KHÔNG tạo/ghi `/uploads/drawings` nữa.
 */
async function ensureDrawingSchema(sequelize) {
  try {
    const storageConfig = resolveStorageConfig();

    // 1. Thư mục upload chỉ cần cho adapter local (dev/test)
    if (storageConfig.provider === 'local') {
      const uploadsDir = storageConfig.local.rootDir
        ? path.join(storageConfig.local.rootDir, 'drawings')
        : path.resolve(__dirname, '../../uploads/drawings');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
    }

    // 2. Sync Drawing models (tạo bảng nếu chưa có)
    await Drawing.sync();
    await DrawingLike.sync();

    // 3. Bổ sung cột metadata lưu trữ nếu migration chưa chạy
    const queryInterface = sequelize.getQueryInterface();
    const table = await queryInterface.describeTable('drawings').catch(() => null);
    if (table) {
      for (const column of STORAGE_COLUMNS) {
        if (!table[column.name]) {
          await queryInterface
            .addColumn('drawings', column.name, column.definition)
            .catch((err) =>
              console.warn(`[DrawingSchema] Không thêm được cột ${column.name}:`, err.message)
            );
        }
      }
    }
  } catch (err) {
    console.warn('[DrawingSchema] Schema safety sync warning (non-fatal):', err.message);
  }
}

module.exports = { ensureDrawingSchema, STORAGE_COLUMNS };

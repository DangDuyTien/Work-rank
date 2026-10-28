'use strict';

/**
 * WR-AUDIT-003 — Reconcile drawings.likes_count với bảng drawing_likes.
 *
 * Cột likes_count là cache denormalized. Trước đây seed/test có thể ghi counter
 * mà không tạo row trong drawing_likes, khiến UI hiển thị số like "ảo".
 * Migration này đưa cache về đúng COUNT thật (idempotent).
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE drawings d
      SET likes_count = (
        SELECT COUNT(*) FROM drawing_likes dl WHERE dl.drawing_id = d.id
      )
    `);
  },

  async down() {
    // Không thể khôi phục counter sai; down là no-op có chủ đích.
  },
};

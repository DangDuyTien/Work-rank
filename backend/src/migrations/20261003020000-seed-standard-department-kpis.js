'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const contentDepts = await queryInterface.sequelize.query(
      "SELECT id FROM departments WHERE code = 'CONTENT' LIMIT 1",
      { type: Sequelize.QueryTypes.SELECT }
    );
    const contentId = contentDepts?.[0]?.id;
    if (!contentId) {
      throw new Error('[Migration seed-kpis] Required department CONTENT was not found in departments table.');
    }

    const editDepts = await queryInterface.sequelize.query(
      "SELECT id FROM departments WHERE code = 'EDIT' LIMIT 1",
      { type: Sequelize.QueryTypes.SELECT }
    );
    const editId = editDepts?.[0]?.id;
    if (!editId) {
      throw new Error('[Migration seed-kpis] Required department EDIT was not found in departments table.');
    }

    const existingKpis = await queryInterface.sequelize.query(
      "SELECT code FROM kpis",
      { type: Sequelize.QueryTypes.SELECT }
    );
    const existingCodes = new Set((existingKpis || []).map((k) => k.code));

    const kpisToInsert = [];
    if (!existingCodes.has('CONTENT_VIDEO_COMPLETED')) {
      kpisToInsert.push({
        department_id: contentId,
        name: 'Video Hoàn Thành Sản Xuất',
        code: 'CONTENT_VIDEO_COMPLETED',
        description: 'Số lượng kịch bản và video sản xuất hoàn thành trong kỳ',
        unit: 'video',
        target: 20,
        period_type: 'monthly',
        source_type: 'MANUAL',
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
    if (!existingCodes.has('CONTENT_YT_VIEWS')) {
      kpisToInsert.push({
        department_id: contentId,
        name: 'YouTube KPI - Lượt Xem Kênh',
        code: 'CONTENT_YT_VIEWS',
        description: 'Tổng lượt xem đạt được trên các kênh thuộc quyền phụ trách',
        unit: 'views',
        target: 50000,
        period_type: 'monthly',
        source_type: 'YOUTUBE',
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    if (!existingCodes.has('EDIT_VIDEO_FINISHED')) {
      kpisToInsert.push({
        department_id: editId,
        name: 'Video Edit Hoàn Chỉnh',
        code: 'EDIT_VIDEO_FINISHED',
        description: 'Số lượng video hoàn tất hậu kỳ, visual effects và âm thanh',
        unit: 'video',
        target: 25,
        period_type: 'monthly',
        source_type: 'MANUAL',
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
    if (!existingCodes.has('EDIT_REVISION_COUNT')) {
      kpisToInsert.push({
        department_id: editId,
        name: 'Hạn Mức Revision Video',
        code: 'EDIT_REVISION_COUNT',
        description: 'Số lần yêu cầu chỉnh sửa lại kịch bản / video cần kiểm soát',
        unit: 'lần',
        target: 10,
        period_type: 'monthly',
        source_type: 'MANUAL',
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    if (kpisToInsert.length > 0) {
      await queryInterface.bulkInsert('kpis', kpisToInsert);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('kpis', {
      code: ['CONTENT_VIDEO_COMPLETED', 'CONTENT_YT_VIEWS', 'EDIT_VIDEO_FINISHED', 'EDIT_REVISION_COUNT'],
    });
  },
};

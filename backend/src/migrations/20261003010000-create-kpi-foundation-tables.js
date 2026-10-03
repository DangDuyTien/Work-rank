'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create departments table
    const hasDept = await queryInterface.describeTable('departments').then(() => true).catch(() => false);
    if (!hasDept) {
      await queryInterface.createTable('departments', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        code: { type: Sequelize.STRING(64), allowNull: false, unique: true },
        name: { type: Sequelize.STRING(128), allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: true },
        active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        metadata: { type: Sequelize.JSON, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });

      await queryInterface.addIndex('departments', ['code'], { name: 'idx_departments_code', unique: true }).catch(() => {});
      await queryInterface.addIndex('departments', ['active'], { name: 'idx_departments_active' }).catch(() => {});
    }

    // Ensure initial departments exist (both on fresh create and partial migration recovery)
    const existingDepts = await queryInterface.sequelize.query(
      "SELECT code FROM departments",
      { type: Sequelize.QueryTypes.SELECT }
    ).catch(() => []);
    const existingDeptCodes = new Set((existingDepts || []).map((d) => d.code));
    const deptsToSeed = [];
    if (!existingDeptCodes.has('CONTENT')) {
      deptsToSeed.push({
        code: 'CONTENT',
        name: 'Phòng Nội Dung (Content)',
        description: 'Sáng tạo kịch bản, ý tưởng và sản xuất nội dung truyền thông',
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
    if (!existingDeptCodes.has('EDIT')) {
      deptsToSeed.push({
        code: 'EDIT',
        name: 'Phòng Biên Tập (Edit)',
        description: 'Dựng phim, hậu kỳ video, âm thanh và hiệu ứng visual',
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
    if (deptsToSeed.length > 0) {
      await queryInterface.bulkInsert('departments', deptsToSeed);
    }

    // 2. Add department_id column to users table if not exists
    const usersTableInfo = await queryInterface.describeTable('users');
    if (!usersTableInfo.department_id) {
      // NOTE: In MySQL, combining ADD COLUMN and ADD CONSTRAINT FOREIGN KEY in a single
      // ALTER TABLE causes MySQL ERROR 1072: Key column 'department_id' doesn't exist in table.
      // Therefore, add the column first, then add index and constraint separately.
      await queryInterface.addColumn('users', 'department_id', {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      });
      await queryInterface.addIndex('users', ['department_id'], { name: 'idx_users_department_id' }).catch(() => {});
      await queryInterface.addConstraint('users', {
        fields: ['department_id'],
        type: 'foreign key',
        name: 'fk_users_department_id',
        references: {
          table: 'departments',
          field: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }).catch(() => {});
    }

    // Verify and fetch required department IDs
    const contentDepts = await queryInterface.sequelize.query(
      "SELECT id FROM departments WHERE code = 'CONTENT' LIMIT 1",
      { type: Sequelize.QueryTypes.SELECT }
    );
    const contentId = contentDepts?.[0]?.id;
    if (!contentId) {
      throw new Error('[Migration create-kpi-foundation] Required department CONTENT was not found after department seeding.');
    }

    const editDepts = await queryInterface.sequelize.query(
      "SELECT id FROM departments WHERE code = 'EDIT' LIMIT 1",
      { type: Sequelize.QueryTypes.SELECT }
    );
    const editId = editDepts?.[0]?.id;
    if (!editId) {
      throw new Error('[Migration create-kpi-foundation] Required department EDIT was not found after department seeding.');
    }

    // Check schema dependencies before update
    const hasDepartmentColumn = Boolean(usersTableInfo.department);

    if (hasDepartmentColumn) {
      // Map users matching Edit
      await queryInterface.sequelize.query(
        'UPDATE users SET department_id = :editId WHERE department_id IS NULL AND department LIKE :editPattern',
        {
          replacements: {
            editId,
            editPattern: '%Edit%',
          },
        }
      ).catch(() => {});

      // Map users matching Content or unassigned
      await queryInterface.sequelize.query(
        'UPDATE users SET department_id = :contentId WHERE department_id IS NULL AND (department LIKE :contentPattern OR department IS NULL OR department = :emptyVal)',
        {
          replacements: {
            contentId,
            contentPattern: '%Content%',
            emptyVal: '',
          },
        }
      ).catch(() => {});
    } else {
      await queryInterface.sequelize.query(
        'UPDATE users SET department_id = :contentId WHERE department_id IS NULL',
        {
          replacements: { contentId },
        }
      ).catch(() => {});
    }

    // 3. Create kpi_periods table
    const hasPeriods = await queryInterface.describeTable('kpi_periods').then(() => true).catch(() => false);
    if (!hasPeriods) {
      await queryInterface.createTable('kpi_periods', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        code: { type: Sequelize.STRING(64), allowNull: false, unique: true },
        name: { type: Sequelize.STRING(128), allowNull: false },
        period_type: {
          type: Sequelize.ENUM('daily', 'weekly', 'monthly', 'quarterly', 'custom'),
          allowNull: false,
          defaultValue: 'monthly',
        },
        start_date: { type: Sequelize.DATEONLY, allowNull: false },
        end_date: { type: Sequelize.DATEONLY, allowNull: false },
        status: {
          type: Sequelize.ENUM('UPCOMING', 'ACTIVE', 'CLOSED'),
          allowNull: false,
          defaultValue: 'ACTIVE',
        },
        metadata: { type: Sequelize.JSON, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });

      await queryInterface.addIndex('kpi_periods', ['code'], { name: 'idx_kpi_periods_code', unique: true });
      await queryInterface.addIndex('kpi_periods', ['period_type', 'status'], { name: 'idx_kpi_periods_type_status' });

      // Seed current monthly period
      await queryInterface.bulkInsert('kpi_periods', [
        {
          code: '2026-10',
          name: 'Tháng 10/2026',
          period_type: 'monthly',
          start_date: '2026-10-01',
          end_date: '2026-10-31',
          status: 'ACTIVE',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);
    }

    // 4. Create kpis table
    const hasKpis = await queryInterface.describeTable('kpis').then(() => true).catch(() => false);
    if (!hasKpis) {
      await queryInterface.createTable('kpis', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        department_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'departments', key: 'id' },
          onDelete: 'CASCADE',
        },
        name: { type: Sequelize.STRING(160), allowNull: false },
        code: { type: Sequelize.STRING(64), allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: true },
        unit: { type: Sequelize.STRING(48), allowNull: false, defaultValue: 'đơn vị' },
        target: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
        period_type: {
          type: Sequelize.ENUM('daily', 'weekly', 'monthly', 'quarterly', 'custom'),
          allowNull: false,
          defaultValue: 'monthly',
        },
        source_type: { type: Sequelize.STRING(64), allowNull: false, defaultValue: 'MANUAL' },
        active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        metadata: { type: Sequelize.JSON, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });

      await queryInterface.addIndex('kpis', ['department_id', 'active'], { name: 'idx_kpis_dept_active' });
      await queryInterface.addIndex('kpis', ['code'], { name: 'idx_kpis_code' });
    }

    // 5. Create kpi_results table
    const hasResults = await queryInterface.describeTable('kpi_results').then(() => true).catch(() => false);
    if (!hasResults) {
      await queryInterface.createTable('kpi_results', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },
        department_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'departments', key: 'id' },
          onDelete: 'CASCADE',
        },
        kpi_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'kpis', key: 'id' },
          onDelete: 'CASCADE',
        },
        period_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'kpi_periods', key: 'id' },
          onDelete: 'CASCADE',
        },
        target_value: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
        actual_value: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
        status: {
          type: Sequelize.ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED'),
          allowNull: false,
          defaultValue: 'IN_PROGRESS',
        },
        source: { type: Sequelize.STRING(64), allowNull: false, defaultValue: 'MANUAL' },
        metadata: { type: Sequelize.JSON, allowNull: true },
        calculated_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });

      await queryInterface.addIndex('kpi_results', ['user_id', 'kpi_id', 'period_id'], {
        name: 'idx_kpi_results_user_kpi_period_unique',
        unique: true,
      });
      await queryInterface.addIndex('kpi_results', ['department_id', 'period_id'], { name: 'idx_kpi_results_dept_period' });
      await queryInterface.addIndex('kpi_results', ['kpi_id', 'period_id'], { name: 'idx_kpi_results_kpi_period' });
    }

    // 6. Create kpi_events table
    const hasEvents = await queryInterface.describeTable('kpi_events').then(() => true).catch(() => false);
    if (!hasEvents) {
      await queryInterface.createTable('kpi_events', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        kpi_result_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: { model: 'kpi_results', key: 'id' },
          onDelete: 'CASCADE',
        },
        kpi_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'kpis', key: 'id' },
          onDelete: 'CASCADE',
        },
        user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },
        department_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false },
        event_type: { type: Sequelize.STRING(64), allowNull: false },
        value_delta: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
        previous_value: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
        new_value: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
        source: { type: Sequelize.STRING(64), allowNull: false, defaultValue: 'MANUAL' },
        actor_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },
        metadata: { type: Sequelize.JSON, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });

      await queryInterface.addIndex('kpi_events', ['kpi_result_id'], { name: 'idx_kpi_events_result_id' });
      await queryInterface.addIndex('kpi_events', ['kpi_id'], { name: 'idx_kpi_events_kpi_id' });
      await queryInterface.addIndex('kpi_events', ['created_at'], { name: 'idx_kpi_events_created_at' });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('kpi_events').catch(() => {});
    await queryInterface.dropTable('kpi_results').catch(() => {});
    await queryInterface.dropTable('kpis').catch(() => {});
    await queryInterface.dropTable('kpi_periods').catch(() => {});
    const usersTableInfo = await queryInterface.describeTable('users').catch(() => ({}));
    if (usersTableInfo && usersTableInfo.department_id) {
      await queryInterface.removeConstraint('users', 'fk_users_department_id').catch(() => {});
      await queryInterface.removeColumn('users', 'department_id').catch(() => {});
    }
    await queryInterface.dropTable('departments').catch(() => {});
  },
};

'use strict';

const { Op } = require('sequelize');
const {
  Department,
  Kpi,
  KpiPeriod,
  KpiResult,
  KpiEvent,
  User,
  sequelize,
} = require('../models');

class KpiService {
  /**
   * ─── 1. DEPARTMENTS ──────────────────────────────────────────
   */
  async getDepartments() {
    const departments = await Department.findAll({
      order: [['id', 'ASC']],
      include: [
        {
          model: Kpi,
          as: 'kpis',
          attributes: ['id', 'active'],
          required: false,
        },
      ],
    });

    return departments.map((dept) => {
      const plain = dept.toJSON();
      const activeKpisCount = (plain.kpis || []).filter((k) => k.active).length;
      const totalKpisCount = (plain.kpis || []).length;
      return {
        ...plain,
        activeKpisCount,
        totalKpisCount,
      };
    });
  }

  async getDepartmentById(id) {
    return Department.findByPk(id, {
      include: [{ model: Kpi, as: 'kpis' }],
    });
  }

  async createDepartment({ code, name, description, active = true, metadata }) {
    if (!code || !name) {
      throw new Error('Mã và tên phòng ban là bắt buộc');
    }
    const cleanCode = String(code).trim().toUpperCase();
    const existing = await Department.findOne({ where: { code: cleanCode } });
    if (existing) {
      throw new Error(`Phòng ban với mã ${cleanCode} đã tồn tại`);
    }

    return Department.create({
      code: cleanCode,
      name: String(name).trim(),
      description: description ? String(description).trim() : null,
      active: Boolean(active),
      metadata: metadata || null,
    });
  }

  async updateDepartment(id, { name, description, active, metadata }) {
    const dept = await Department.findByPk(id);
    if (!dept) {
      throw new Error('Không tìm thấy phòng ban');
    }

    const updates = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (description !== undefined) updates.description = description ? String(description).trim() : null;
    if (active !== undefined) updates.active = Boolean(active);
    if (metadata !== undefined) updates.metadata = metadata;

    await dept.update(updates);
    return dept;
  }

  /**
   * ─── 2. KPI DEFINITIONS ──────────────────────────────────────
   */
  async getDefinitions({ departmentId, activeOnly = false } = {}) {
    const where = {};
    if (departmentId) where.departmentId = departmentId;
    if (activeOnly) where.active = true;

    return Kpi.findAll({
      where,
      include: [
        { model: Department, as: 'department', attributes: ['id', 'code', 'name'] },
      ],
      order: [['departmentId', 'ASC'], ['id', 'ASC']],
    });
  }

  async getDefinitionById(id) {
    return Kpi.findByPk(id, {
      include: [{ model: Department, as: 'department' }],
    });
  }

  async createDefinition({
    departmentId,
    name,
    code,
    description,
    unit = 'đơn vị',
    target = 0,
    periodType = 'monthly',
    sourceType = 'MANUAL',
    active = true,
    metadata,
  }) {
    if (!departmentId || !name) {
      throw new Error('Phòng ban và tên KPI là bắt buộc');
    }

    const dept = await Department.findByPk(departmentId);
    if (!dept) {
      throw new Error('Phòng ban không tồn tại');
    }

    const cleanCode = code
      ? String(code).trim().toUpperCase()
      : `${dept.code}_KPI_${Date.now()}`;

    return Kpi.create({
      departmentId,
      name: String(name).trim(),
      code: cleanCode,
      description: description ? String(description).trim() : null,
      unit: String(unit).trim() || 'đơn vị',
      target: Number(target) || 0,
      periodType: ['daily', 'weekly', 'monthly', 'quarterly', 'custom'].includes(periodType)
        ? periodType
        : 'monthly',
      sourceType: String(sourceType || 'MANUAL').toUpperCase(),
      active: Boolean(active),
      metadata: metadata || null,
    });
  }

  async updateDefinition(id, {
    name,
    code,
    description,
    unit,
    target,
    periodType,
    sourceType,
    active,
    metadata,
  }) {
    const kpi = await Kpi.findByPk(id);
    if (!kpi) {
      throw new Error('Không tìm thấy KPI');
    }

    const updates = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (code !== undefined) updates.code = String(code).trim().toUpperCase();
    if (description !== undefined) updates.description = description ? String(description).trim() : null;
    if (unit !== undefined) updates.unit = String(unit).trim();
    if (target !== undefined) updates.target = Number(target) || 0;
    if (periodType !== undefined) {
      updates.periodType = ['daily', 'weekly', 'monthly', 'quarterly', 'custom'].includes(periodType)
        ? periodType
        : kpi.periodType;
    }
    if (sourceType !== undefined) updates.sourceType = String(sourceType).toUpperCase();
    if (active !== undefined) updates.active = Boolean(active);
    if (metadata !== undefined) updates.metadata = metadata;

    await kpi.update(updates);
    return kpi;
  }

  async toggleDefinition(id) {
    const kpi = await Kpi.findByPk(id);
    if (!kpi) {
      throw new Error('Không tìm thấy KPI');
    }
    await kpi.update({ active: !kpi.active });
    return kpi;
  }

  async deleteDefinition(id) {
    const kpi = await Kpi.findByPk(id);
    if (!kpi) {
      throw new Error('Không tìm thấy KPI');
    }
    await kpi.destroy();
    return { success: true, id };
  }

  /**
   * ─── 3. KPI PERIODS ──────────────────────────────────────────
   */
  async getPeriods({ status, periodType } = {}) {
    const where = {};
    if (status) where.status = status;
    if (periodType) where.periodType = periodType;

    return KpiPeriod.findAll({
      where,
      order: [['startDate', 'DESC'], ['id', 'DESC']],
    });
  }

  async getOrCreateCurrentPeriod() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const code = `${year}-${month}`;

    let period = await KpiPeriod.findOne({ where: { code } });
    if (!period) {
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      period = await KpiPeriod.create({
        code,
        name: `Tháng ${now.getMonth() + 1}/${year}`,
        periodType: 'monthly',
        startDate: `${year}-${month}-01`,
        endDate: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
        status: 'ACTIVE',
      });
    }
    return period;
  }

  async createPeriod({ code, name, periodType = 'monthly', startDate, endDate, status = 'ACTIVE', metadata }) {
    if (!code || !name || !startDate || !endDate) {
      throw new Error('Vui lòng điền đầy đủ mã kỳ, tên kỳ, ngày bắt đầu và kết thúc');
    }

    return KpiPeriod.create({
      code: String(code).trim().toUpperCase(),
      name: String(name).trim(),
      periodType,
      startDate,
      endDate,
      status,
      metadata: metadata || null,
    });
  }

  /**
   * ─── 4. KPI RESULTS & AUDIT TRAIL ───────────────────────────
   */
  async getResults({ departmentId, periodId, userId } = {}) {
    const where = {};
    if (departmentId) where.departmentId = departmentId;
    if (periodId) where.periodId = periodId;
    if (userId) where.userId = userId;

    const results = await KpiResult.findAll({
      where,
      include: [
        { model: Department, as: 'department', attributes: ['id', 'code', 'name'] },
        { model: Kpi, as: 'kpi', attributes: ['id', 'code', 'name', 'unit', 'target', 'periodType', 'sourceType'] },
        { model: KpiPeriod, as: 'period', attributes: ['id', 'code', 'name', 'startDate', 'endDate', 'status'] },
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'jobTitle', 'department'] },
      ],
      order: [['id', 'DESC']],
    });

    return results.map((r) => {
      const plain = r.toJSON();
      const target = Number(plain.targetValue || 0);
      const actual = Number(plain.actualValue || 0);
      const progress = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
      return {
        ...plain,
        targetValue: target,
        actualValue: actual,
        progress,
        progressPct: progress,
      };
    });
  }

  async recordResult({
    kpiId,
    userId = null,
    departmentId = null,
    periodId = null,
    targetValue = null,
    actualValue = 0,
    source = 'MANUAL',
    metadata = null,
    actorId = null,
  }) {
    if (!kpiId) {
      throw new Error('KPI ID là bắt buộc');
    }

    const kpi = await Kpi.findByPk(kpiId);
    if (!kpi) {
      throw new Error('Không tìm thấy KPI');
    }

    const effectiveDeptId = departmentId || kpi.departmentId;

    let effectivePeriodId = periodId;
    if (!effectivePeriodId) {
      const currentPeriod = await this.getOrCreateCurrentPeriod();
      effectivePeriodId = currentPeriod.id;
    }

    const effectiveTarget = targetValue !== null && targetValue !== undefined
      ? Number(targetValue)
      : Number(kpi.target || 0);

    const safeActual = Number(actualValue) || 0;

    // Determine status
    let status = 'IN_PROGRESS';
    if (effectiveTarget > 0 && safeActual >= effectiveTarget) {
      status = 'COMPLETED';
    } else if (safeActual === 0) {
      status = 'PENDING';
    }

    // Upsert transaction
    const t = await sequelize.transaction();
    try {
      const whereCondition = {
        kpiId,
        periodId: effectivePeriodId,
        ...(userId ? { userId } : { userId: null }),
      };

      let [result, created] = await KpiResult.findOrCreate({
        where: whereCondition,
        defaults: {
          userId: userId || null,
          departmentId: effectiveDeptId,
          kpiId,
          periodId: effectivePeriodId,
          targetValue: effectiveTarget,
          actualValue: safeActual,
          status,
          source: String(source || 'MANUAL').toUpperCase(),
          metadata: metadata || null,
          calculatedAt: new Date(),
        },
        transaction: t,
      });

      let previousVal = 0;
      let delta = safeActual;

      if (!created) {
        previousVal = Number(result.actualValue || 0);
        delta = safeActual - previousVal;

        await result.update({
          targetValue: effectiveTarget,
          actualValue: safeActual,
          status,
          source: String(source || result.source || 'MANUAL').toUpperCase(),
          metadata: metadata !== undefined ? metadata : result.metadata,
          calculatedAt: new Date(),
        }, { transaction: t });
      }

      // Log audit trail event
      await KpiEvent.create({
        kpiResultId: result.id,
        kpiId,
        userId: userId || null,
        departmentId: effectiveDeptId,
        eventType: created ? 'RESULT_CREATED' : 'VALUE_UPDATED',
        valueDelta: delta,
        previousValue: previousVal,
        newValue: safeActual,
        source: String(source || 'MANUAL').toUpperCase(),
        actorId: actorId || null,
        metadata: metadata || null,
      }, { transaction: t });

      await t.commit();

      const progress = effectiveTarget > 0
        ? Math.min(100, Math.round((safeActual / effectiveTarget) * 100))
        : 0;

      return {
        ...result.toJSON(),
        targetValue: effectiveTarget,
        actualValue: safeActual,
        progress,
        progressPct: progress,
        status,
      };
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }

  async getResultHistory({ kpiResultId, kpiId, userId, limit = 50 } = {}) {
    const where = {};
    if (kpiResultId) where.kpiResultId = kpiResultId;
    if (kpiId) where.kpiId = kpiId;
    if (userId) where.userId = userId;

    return KpiEvent.findAll({
      where,
      limit: Math.min(100, Math.max(1, Number(limit) || 50)),
      order: [['createdAt', 'DESC']],
      include: [
        { model: KpiResult, as: 'kpiResult', attributes: ['id', 'targetValue', 'actualValue', 'status'] },
      ],
    });
  }

  /**
   * ─── 5. USER KPI SUMMARY (Dashboard Consumption) ────────────
   */
  async getMyKpis(userId) {
    if (!userId) {
      throw new Error('User ID là bắt buộc');
    }

    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('Không tìm thấy người dùng');
    }

    // Resolve user's department:
    // 1. By departmentId FK if present
    // 2. Fallback by matching user.department string with Department code/name
    let dept = null;
    if (user.departmentId) {
      dept = await Department.findByPk(user.departmentId);
    }
    if (!dept) {
      const userDeptStr = String(user.department || '').toLowerCase();
      if (userDeptStr.includes('edit')) {
        dept = await Department.findOne({ where: { code: 'EDIT' } });
      } else {
        dept = await Department.findOne({ where: { code: 'CONTENT' } });
      }
    }
    if (!dept) {
      dept = await Department.findOne({ where: { active: true } });
    }

    // Get active period (current month)
    const currentPeriod = await this.getOrCreateCurrentPeriod();

    if (!dept) {
      return {
        department: null,
        period: currentPeriod,
        currentPeriod,
        kpis: [],
      };
    }

    // Fetch active KPIs configured for this department
    const kpiDefinitions = await Kpi.findAll({
      where: {
        departmentId: dept.id,
        active: true,
      },
      order: [['id', 'ASC']],
    });

    // Fetch user's recorded results for this period
    const kpiIds = kpiDefinitions.map((k) => k.id);
    const existingResults = await KpiResult.findAll({
      where: {
        userId,
        periodId: currentPeriod.id,
        kpiId: { [Op.in]: kpiIds },
      },
    });

    const resultMap = new Map(existingResults.map((r) => [Number(r.kpiId), r]));

    const assignedKpis = kpiDefinitions.map((kpi) => {
      const res = resultMap.get(Number(kpi.id));
      const targetValue = res ? Number(res.targetValue) : Number(kpi.target || 0);
      const actualValue = res ? Number(res.actualValue) : 0;
      const progress = targetValue > 0
        ? Math.min(100, Math.round((actualValue / targetValue) * 100))
        : 0;

      return {
        id: kpi.id,
        kpiId: kpi.id,
        name: kpi.name,
        code: kpi.code,
        description: kpi.description,
        unit: kpi.unit,
        target: targetValue,
        targetValue,
        actual: actualValue,
        actualValue,
        progress,
        progressPct: progress,
        status: res ? res.status : 'PENDING',
        periodType: kpi.periodType,
        sourceType: kpi.sourceType,
        calculatedAt: res?.calculatedAt || null,
      };
    });

    return {
      department: {
        id: dept.id,
        code: dept.code,
        name: dept.name,
        description: dept.description,
      },
      period: {
        id: currentPeriod.id,
        code: currentPeriod.code,
        name: currentPeriod.name,
        startDate: currentPeriod.startDate,
        endDate: currentPeriod.endDate,
      },
      currentPeriod: {
        id: currentPeriod.id,
        code: currentPeriod.code,
        name: currentPeriod.name,
        startDate: currentPeriod.startDate,
        endDate: currentPeriod.endDate,
      },
      kpis: assignedKpis,
    };
  }
}

module.exports = new KpiService();

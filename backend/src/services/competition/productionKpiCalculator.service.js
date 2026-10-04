'use strict';

const crypto = require('node:crypto');
const {
  sequelize,
  ProductionKpiExecutionSnapshot,
  CompetitionEvent,
  ScoreLedger,
  User,
  Team,
} = require('../../models');
const excelKpiImporter = require('./excelKpiImporter.service');
const effectEngine = require('./effectEngine.service');
const competitionReadModelProjector = require('./competitionReadModel.projector');

async function refreshReadModels(snapshot) {
  const seasonId = snapshot?.seasonId || null;
  if (seasonId) {
    await competitionReadModelProjector.projectSeasonLeaderboard(seasonId);
    await competitionReadModelProjector.projectSeasonIndividualLeaderboard(seasonId);
  }
  if (snapshot?.userId) {
    await competitionReadModelProjector.projectUserSummary(snapshot.userId, { seasonId });
  }
  if (snapshot?.teamId) {
    await competitionReadModelProjector.projectTeamSummary(snapshot.teamId, { seasonId });
  }
}

/** BIGINT aggregate_id: only numeric ids are stored; string ids live in the payload. */
function toNumericIdOrNull(value) {
  return /^\d+$/.test(String(value)) ? Number(value) : null;
}

/**
 * Validate that start and completed dates are valid and logically sequenced.
 */
function validateTimestamps(startedAt, completedAt) {
  if (!startedAt || !completedAt) {
    const error = new Error('Thời gian bắt đầu (startedAt) và hoàn thành (completedAt) là bắt buộc.');
    error.statusCode = 400;
    throw error;
  }

  const start = new Date(startedAt);
  const end = new Date(completedAt);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    const error = new Error('Thời gian bắt đầu hoặc hoàn thành không đúng định dạng ngày giờ.');
    error.statusCode = 400;
    throw error;
  }

  if (end.getTime() < start.getTime()) {
    const error = new Error('Thời gian hoàn thành không được sớm hơn thời gian bắt đầu.');
    error.statusCode = 400;
    throw error;
  }

  const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
  return { start, end, durationMinutes };
}

/**
 * Calculate and award KPI for an Editor finishing 1 episode.
 *
 * @param {object} params
 * @param {number} params.editorId
 * @param {string} params.episodeId
 * @param {string} [params.taskType='EPISODE_FULL']
 * @param {Date|string} params.startedAt
 * @param {Date|string} params.completedAt
 * @param {number} [params.teamId]
 * @param {number} [params.seasonId]
 * @param {number} [params.actorId]
 * @param {string} [params.reason]
 */
async function evaluateEditorTask(params) {
  const {
    editorId,
    episodeId,
    taskType = 'EPISODE_FULL',
    startedAt,
    completedAt,
    teamId: providedTeamId,
    seasonId = null,
    actorId = null,
    reason = '',
  } = params;

  if (!editorId || !episodeId) {
    const error = new Error('Mã Editor (editorId) và Mã tập phim/video (episodeId) là bắt buộc.');
    error.statusCode = 400;
    throw error;
  }

  // 1. Verify User exists and is active
  const editor = await User.findByPk(editorId);
  if (!editor || editor.status !== 'active') {
    const error = new Error('Tài khoản Editor không tồn tại hoặc đã bị vô hiệu hóa.');
    error.statusCode = 400;
    throw error;
  }
  const effectiveTeamId = providedTeamId || editor.teamId || null;

  // 2. Validate timestamps
  const { start, end, durationMinutes } = validateTimestamps(startedAt, completedAt);

  // 3. Resolve active KPI rule
  const activeRule = await excelKpiImporter.getActiveRule('EDITOR', taskType);
  if (!activeRule) {
    const error = new Error(
      `Chưa có cấu hình KPI nào đang kích hoạt cho Editor với hạng mục "${taskType}". Vui lòng import hoặc kích hoạt phiên bản KPI chuẩn từ Excel.`
    );
    error.statusCode = 400;
    throw error;
  }

  // 4. Check Idempotency / Anti-farming
  const idempotencyKey = `kpi:editor:${episodeId}:${editorId}:${activeRule.version}`;
  const existingSnapshot = await ProductionKpiExecutionSnapshot.findOne({
    where: { idempotencyKey },
  });
  if (existingSnapshot) {
    return {
      success: true,
      duplicate: true,
      message: 'Tập phim/video này đã được tính KPI trước đó (chống duplicate).',
      snapshot: existingSnapshot,
    };
  }

  // 5. Calculate KPI Efficiency & Points/XP
  const standardTime = activeRule.standardTime || 180; // minutes
  const performanceRatio = durationMinutes / standardTime;

  let points = 0;
  let xp = 0;
  let efficiencyRating = '';

  if (durationMinutes <= standardTime) {
    // Completed faster than or equal to benchmark -> High efficiency bonus
    const efficiency = durationMinutes > 0 ? standardTime / durationMinutes : 2.0;
    const cappedEfficiency = Math.min(Math.max(efficiency, 1.0), 2.0); // max 200% bonus
    points = Math.round(activeRule.pointBase * cappedEfficiency);
    xp = Math.round(activeRule.xpBase * cappedEfficiency);
    efficiencyRating = `${(efficiency * 100).toFixed(1)}% (Vượt/Đạt chuẩn)`;
  } else {
    // Completed slower than benchmark -> Scaled lower efficiency
    const efficiency = standardTime / durationMinutes;
    const flooredEfficiency = Math.max(efficiency, 0.4); // min 40% base points
    points = Math.round(activeRule.pointBase * flooredEfficiency);
    xp = Math.round(activeRule.xpBase * flooredEfficiency);
    efficiencyRating = `${(efficiency * 100).toFixed(1)}% (Dưới chuẩn)`;
  }

  // 6. Persist atomically to CompetitionEvent, ScoreLedger, and ProductionKpiExecutionSnapshot
  let resultSnapshot;

  await sequelize.transaction(async (transaction) => {
    const eventId = crypto.randomUUID();

    // A. Record CompetitionEvent
    const compEvent = await CompetitionEvent.create(
      {
        eventId,
        eventType: 'PRODUCTION_KPI_EVALUATED',
        sourceModule: 'production_kpi',
        aggregateType: 'editor_task',
        aggregateId: toNumericIdOrNull(episodeId),
        actorId: editor.id,
        teamId: effectiveTeamId,
        occurredAt: end,
        // Effects are persisted in this same transaction → mark as processed so no
        // async worker re-evaluates the event and awards points a second time.
        status: 'PROCESSED',
        processedAt: new Date(),
        idempotencyKey,
        payload: {
          role: 'EDITOR',
          episodeId,
          taskType,
          startedAt: start.toISOString(),
          completedAt: end.toISOString(),
          actualDurationMinutes: Math.round(durationMinutes * 100) / 100,
          standardTimeMinutes: standardTime,
          performanceRatio: Math.round(performanceRatio * 1000) / 1000,
          efficiencyRating,
          points,
          xp,
          ruleVersion: activeRule.version,
        },
      },
      { transaction }
    );

    // B. Record ScoreLedger via EffectEngine
    const scoreLedgerMetadata = {
      kpiRole: 'EDITOR',
      taskType,
      kpiRuleId: activeRule.id,
      ruleVersion: activeRule.version,
      standardTimeMinutes: standardTime,
      actualDurationMinutes: Math.round(durationMinutes * 100) / 100,
      performanceRatio: Math.round(performanceRatio * 1000) / 1000,
      efficiencyRating,
      pointsAwarded: points,
      xpAwarded: xp,
      episodeId,
      startedAt: start.toISOString(),
      completedAt: end.toISOString(),
      calculatedAt: new Date().toISOString(),
    };

    const effects = [
      {
        effectType: 'INDIVIDUAL_XP',
        targetType: 'USER',
        targetId: editor.id,
        delta: points,
      },
    ];

    if (effectiveTeamId) {
      effects.push({
        effectType: 'TEAM_SCORE',
        targetType: 'TEAM',
        targetId: effectiveTeamId,
        delta: points,
      });
    }

    const { inserted } = await effectEngine.persistEffects({
      eventId: compEvent.eventId,
      ruleVersionId: null,
      seasonId,
      effects,
      reason: reason || `KPI Editor: Hoàn thành tập #${episodeId} (${efficiencyRating})`,
      metadata: scoreLedgerMetadata,
      transaction,
    });

    // C. Retrieve the created ScoreLedger row ID
    const ledgerRow = await ScoreLedger.findOne({
      where: { eventId: compEvent.eventId },
      transaction,
    });

    // D. Insert Execution Snapshot
    resultSnapshot = await ProductionKpiExecutionSnapshot.create(
      {
        id: crypto.randomUUID(),
        ruleId: activeRule.id,
        ruleVersion: activeRule.version,
        role: 'EDITOR',
        userId: editor.id,
        teamId: effectiveTeamId,
        seasonId,
        taskId: String(episodeId),
        taskType,
        metric: 'COMPLETION_DURATION',
        actualValue: Math.round(durationMinutes * 100) / 100,
        standardValue: standardTime,
        performanceRatio: Math.round(performanceRatio * 1000) / 1000,
        efficiencyRating,
        pointsAwarded: points,
        xpAwarded: xp,
        eventId: compEvent.eventId,
        ledgerId: ledgerRow?.id || null,
        idempotencyKey,
        startedAt: start,
        completedAt: end,
        calculatedAt: new Date(),
        details: scoreLedgerMetadata,
      },
      { transaction }
    );
  });

  // 7. Trigger Read Model Projection Update
  try {
    await refreshReadModels(resultSnapshot);
  } catch (projErr) {
    console.warn('[productionKpiCalculator] ReadModel projection update notice:', projErr.message);
  }

  return {
    success: true,
    duplicate: false,
    pointsAwarded: points,
    xpAwarded: xp,
    efficiencyRating,
    actualDurationMinutes: Math.round(durationMinutes * 100) / 100,
    standardTimeMinutes: standardTime,
    snapshot: resultSnapshot,
  };
}

/**
 * Calculate and award KPI for a Content Creator based on weekly output and average duration.
 *
 * @param {object} params
 * @param {number} params.contentCreatorId
 * @param {string} params.weekKey e.g. "2026-W40"
 * @param {Array<object>} params.completedEpisodes Array of { episodeId, taskType, startedAt, completedAt }
 * @param {number} [params.teamId]
 * @param {number} [params.seasonId]
 * @param {number} [params.actorId]
 * @param {string} [params.reason]
 */
async function evaluateContentWeekly(params) {
  const {
    contentCreatorId,
    weekKey,
    completedEpisodes = [],
    teamId: providedTeamId,
    seasonId = null,
    actorId = null,
    reason = '',
  } = params;

  if (!contentCreatorId || !weekKey) {
    const error = new Error('Mã nhân sự Content (contentCreatorId) và Tuần đánh giá (weekKey) là bắt buộc.');
    error.statusCode = 400;
    throw error;
  }

  if (!Array.isArray(completedEpisodes) || completedEpisodes.length === 0) {
    const error = new Error('Danh sách tập/kịch bản hoàn thành trong tuần (completedEpisodes) không được rỗng.');
    error.statusCode = 400;
    throw error;
  }

  // 1. Verify User
  const creator = await User.findByPk(contentCreatorId);
  if (!creator || creator.status !== 'active') {
    const error = new Error('Tài khoản Content không tồn tại hoặc đã bị vô hiệu hóa.');
    error.statusCode = 400;
    throw error;
  }
  const effectiveTeamId = providedTeamId || creator.teamId || null;

  // 2. Validate all episodes & calculate total and average duration
  let totalValidDurationMinutes = 0;
  const validatedEpisodesList = [];

  for (const ep of completedEpisodes) {
    if (!ep.episodeId) {
      const error = new Error('Mỗi tập trong danh sách hoàn thành phải có mã episodeId.');
      error.statusCode = 400;
      throw error;
    }
    const { start, end, durationMinutes } = validateTimestamps(ep.startedAt, ep.completedAt);
    totalValidDurationMinutes += durationMinutes;
    validatedEpisodesList.push({
      episodeId: ep.episodeId,
      taskType: ep.taskType || 'SCRIPT_STANDARD',
      startedAt: start.toISOString(),
      completedAt: end.toISOString(),
      durationMinutes: Math.round(durationMinutes * 100) / 100,
    });
  }

  const weeklyOutput = validatedEpisodesList.length;
  const averageTimePerEpisode = totalValidDurationMinutes / weeklyOutput;

  // 3. Resolve active KPI rule for Content
  const primaryTaskType = validatedEpisodesList[0]?.taskType || 'SCRIPT_STANDARD';
  const activeRule = await excelKpiImporter.getActiveRule('CONTENT', primaryTaskType);
  if (!activeRule) {
    const error = new Error(
      `Chưa có cấu hình KPI nào đang kích hoạt cho Content. Vui lòng import hoặc kích hoạt phiên bản KPI chuẩn từ Excel.`
    );
    error.statusCode = 400;
    throw error;
  }

  // 4. Check Idempotency / Anti-farming
  const idempotencyKey = `kpi:content:weekly:${contentCreatorId}:${weekKey}:${activeRule.version}`;
  const existingSnapshot = await ProductionKpiExecutionSnapshot.findOne({
    where: { idempotencyKey },
  });
  if (existingSnapshot) {
    return {
      success: true,
      duplicate: true,
      message: `KPI Content tuần ${weekKey} đã được tính trước đó (chống duplicate).`,
      snapshot: existingSnapshot,
    };
  }

  // 5. Calculate KPI Efficiency & Points/XP
  const targetWeeklyOutput = activeRule.targetValue || 5; // e.g. 5 episodes/week
  const standardTimePerEpisode = activeRule.standardTime || 120; // e.g. 120 min/script

  const outputRatio = weeklyOutput / targetWeeklyOutput;
  const timeEfficiency = standardTimePerEpisode / Math.max(averageTimePerEpisode, 1);
  const cappedTimeEfficiency = Math.min(Math.max(timeEfficiency, 0.5), 1.5);

  const combinedMultiplier = outputRatio * cappedTimeEfficiency;
  const points = Math.round(activeRule.pointBase * combinedMultiplier);
  const xp = Math.round(activeRule.xpBase * combinedMultiplier);

  const efficiencyRating = `Sản lượng: ${weeklyOutput}/${targetWeeklyOutput} tập, TB: ${Math.round(averageTimePerEpisode)}p/tập (${(combinedMultiplier * 100).toFixed(1)}%)`;

  // 6. Persist atomically
  let resultSnapshot;

  await sequelize.transaction(async (transaction) => {
    const eventId = crypto.randomUUID();

    // A. Record CompetitionEvent
    const compEvent = await CompetitionEvent.create(
      {
        eventId,
        eventType: 'PRODUCTION_KPI_EVALUATED',
        sourceModule: 'production_kpi',
        aggregateType: 'content_weekly',
        aggregateId: toNumericIdOrNull(creator.id),
        actorId: creator.id,
        teamId: effectiveTeamId,
        occurredAt: new Date(validatedEpisodesList[validatedEpisodesList.length - 1].completedAt),
        status: 'PROCESSED',
        processedAt: new Date(),
        idempotencyKey,
        payload: {
          role: 'CONTENT',
          weekKey,
          weeklyOutput,
          targetWeeklyOutput,
          totalDurationMinutes: Math.round(totalValidDurationMinutes * 100) / 100,
          averageTimePerEpisode: Math.round(averageTimePerEpisode * 100) / 100,
          standardTimePerEpisode,
          combinedMultiplier: Math.round(combinedMultiplier * 1000) / 1000,
          efficiencyRating,
          episodesCount: weeklyOutput,
          points,
          xp,
          ruleVersion: activeRule.version,
        },
      },
      { transaction }
    );

    // B. Record ScoreLedger
    const scoreLedgerMetadata = {
      kpiRole: 'CONTENT',
      kpiRuleId: activeRule.id,
      weekKey,
      weeklyOutput,
      targetWeeklyOutput,
      totalDurationMinutes: Math.round(totalValidDurationMinutes * 100) / 100,
      averageTimePerEpisode: Math.round(averageTimePerEpisode * 100) / 100,
      standardTimePerEpisode,
      pointsAwarded: points,
      xpAwarded: xp,
      efficiencyRating,
      episodes: validatedEpisodesList,
      ruleVersion: activeRule.version,
      calculatedAt: new Date().toISOString(),
    };

    const effects = [
      {
        effectType: 'INDIVIDUAL_XP',
        targetType: 'USER',
        targetId: creator.id,
        delta: points,
      },
    ];

    if (effectiveTeamId) {
      effects.push({
        effectType: 'TEAM_SCORE',
        targetType: 'TEAM',
        targetId: effectiveTeamId,
        delta: points,
      });
    }

    await effectEngine.persistEffects({
      eventId: compEvent.eventId,
      ruleVersionId: null,
      seasonId,
      effects,
      reason: reason || `KPI Content tuần ${weekKey}: ${efficiencyRating}`,
      metadata: scoreLedgerMetadata,
      transaction,
    });

    const ledgerRow = await ScoreLedger.findOne({
      where: { eventId: compEvent.eventId },
      transaction,
    });

    // C. Insert Snapshot
    resultSnapshot = await ProductionKpiExecutionSnapshot.create(
      {
        id: crypto.randomUUID(),
        ruleId: activeRule.id,
        ruleVersion: activeRule.version,
        role: 'CONTENT',
        userId: creator.id,
        teamId: effectiveTeamId,
        seasonId,
        taskId: weekKey,
        taskType: primaryTaskType,
        metric: 'WEEKLY_OUTPUT_AND_AVG_TIME',
        actualValue: weeklyOutput,
        standardValue: targetWeeklyOutput,
        performanceRatio: Math.round(outputRatio * 1000) / 1000,
        efficiencyRating,
        pointsAwarded: points,
        xpAwarded: xp,
        eventId: compEvent.eventId,
        ledgerId: ledgerRow?.id || null,
        idempotencyKey,
        startedAt: new Date(validatedEpisodesList[0].startedAt),
        completedAt: new Date(validatedEpisodesList[validatedEpisodesList.length - 1].completedAt),
        calculatedAt: new Date(),
        details: scoreLedgerMetadata,
      },
      { transaction }
    );
  });

  // 7. Update Read Models
  try {
    await refreshReadModels(resultSnapshot);
  } catch (projErr) {
    console.warn('[productionKpiCalculator] ReadModel projection update notice:', projErr.message);
  }

  return {
    success: true,
    duplicate: false,
    pointsAwarded: points,
    xpAwarded: xp,
    weeklyOutput,
    averageTimePerEpisode: Math.round(averageTimePerEpisode * 100) / 100,
    efficiencyRating,
    snapshot: resultSnapshot,
  };
}

/**
 * Get KPI execution snapshots / audit history.
 */
async function getExecutionHistory({
  userId = null,
  role = null,
  seasonId = null,
  limit = 50,
  offset = 0,
} = {}) {
  const where = {};
  if (userId) where.userId = userId;
  if (role) where.role = role;
  if (seasonId) where.seasonId = seasonId;

  return ProductionKpiExecutionSnapshot.findAndCountAll({
    where,
    order: [['calculated_at', 'DESC']],
    limit: Math.min(Number(limit) || 50, 100),
    offset: Number(offset) || 0,
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'jobTitle', 'department'],
      },
      {
        model: Team,
        as: 'team',
        attributes: ['id', 'name'],
      },
    ],
  });
}

module.exports = {
  evaluateEditorTask,
  evaluateContentWeekly,
  getExecutionHistory,
};

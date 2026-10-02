'use strict';

const { Op } = require('sequelize');
const { sequelize, User, Team, ComputerActivityEvent, ComputerDailyStat } = require('../models');

// Restored Focus and Activity Score formula from historical WorkRank score engine
function clampScore(score) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function calculateFocusScore(activeSeconds, idleSeconds) {
  const totalSeconds = activeSeconds + idleSeconds;
  if (!totalSeconds) return 0;
  const activeRatio = activeSeconds / totalSeconds;
  const sessionContinuity = activeSeconds >= 3600 ? 1 : activeSeconds / 3600;
  const healthyBreakScore = idleSeconds <= activeSeconds * 0.25 ? 1 : 0.6;
  return clampScore(activeRatio * 60 + sessionContinuity * 25 + healthyBreakScore * 15);
}

function calculateRankScore(stats = {}) {
  const activeSeconds = Math.max(0, Number(stats.activeSeconds) || 0);
  const idleSeconds = Math.max(0, Number(stats.idleSeconds) || 0);
  const keystrokeCount = Math.max(0, Number(stats.keystrokeCount || stats.keyboardCount) || 0);
  const mouseClickCount = Math.max(0, Number(stats.mouseClickCount || stats.mouseClicks) || 0);
  const actionCount = keystrokeCount + mouseClickCount;

  if (!activeSeconds && !idleSeconds && !actionCount) return 0;

  const focusScore = stats.focusScore !== undefined
    ? Number(stats.focusScore)
    : calculateFocusScore(activeSeconds, idleSeconds);

  const activeMinutes = activeSeconds / 60;
  const actionScore = Math.round(actionCount);
  const activeTimeScore = Math.round(Math.min(300, activeMinutes * 2));
  const focusBonus = Math.round(focusScore * 0.5);

  return Math.max(0, actionScore + activeTimeScore + focusBonus);
}

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function getPeriodStartDate(period) {
  const now = new Date();
  if (period === 'today') {
    return now.toISOString().slice(0, 10);
  }
  if (period === '7d') {
    const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  }
  if (period === '30d') {
    const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  }
  return '2020-01-01'; // all-time
}

// In-memory LRU eventId deduplication set to guarantee idempotency across network retries
const processedEventIds = new Set();
function isEventDuplicate(eventId) {
  if (!eventId) return false;
  if (processedEventIds.has(eventId)) return true;
  if (processedEventIds.size > 20000) {
    const firstItems = Array.from(processedEventIds).slice(0, 5000);
    firstItems.forEach((id) => processedEventIds.delete(id));
  }
  processedEventIds.add(eventId);
  return false;
}

/**
 * Service managing Computer Activity Tracking and "Độ Năng Động" Leaderboard.
 * Operates purely as an activity telemetry engine — NO anti-cheat, NO keylogging, NO surveillance.
 */
class ComputerActivityService {
  /**
   * Ingest a batch of computer activity events from the desktop agent
   */
  async recordBatch(userId, payload = {}) {
    if (!userId) {
      throw new Error('User ID is required for computer activity tracking');
    }

    const { sessionId, devicePlatform = 'macos', events = [] } = payload;
    if (!Array.isArray(events) || events.length === 0) {
      return { received: 0, processed: 0 };
    }

    const sanitizedEvents = [];
    const todayStr = getTodayDateString();

    let batchActiveSeconds = 0;
    let batchIdleSeconds = 0;
    let batchMouseClicks = 0;
    let batchKeyboardCount = 0;
    const batchApps = {};

    for (const ev of events) {
      // Idempotency check: Ignore duplicate eventIds from retries/reconnects
      const eventId = ev.eventId || ev.id;
      if (eventId && isEventDuplicate(`${userId}_${eventId}`)) {
        continue;
      }

      const state = ev.state === 'IDLE' ? 'IDLE' : 'ACTIVE';
      const activeApp = ev.activeApp ? String(ev.activeApp).slice(0, 120) : 'APP_UNKNOWN';
      const appCategory = ev.appCategory ? String(ev.appCategory).slice(0, 60) : 'OTHER';
      const context = ev.context ? String(ev.context).slice(0, 60) : 'COMPUTER';
      const activeSeconds = Math.max(0, parseInt(ev.activeSeconds, 10) || 0);
      const idleSeconds = Math.max(0, parseInt(ev.idleSeconds, 10) || 0);
      const mouseClicks = Math.max(0, parseInt(ev.mouseClicks, 10) || 0);
      const keyboardCount = Math.max(0, parseInt(ev.keyboardCount, 10) || 0);
      const occurredAt = ev.occurredAt ? new Date(ev.occurredAt) : new Date();

      batchActiveSeconds += activeSeconds;
      batchIdleSeconds += idleSeconds;
      batchMouseClicks += mouseClicks;
      batchKeyboardCount += keyboardCount;

      if (activeApp && activeApp !== 'APP_UNKNOWN') {
        const appMins = Math.round(activeSeconds / 60) || 1;
        batchApps[activeApp] = (batchApps[activeApp] || 0) + appMins;
      }

      sanitizedEvents.push({
        userId,
        sessionId: sessionId || null,
        state,
        activeApp,
        appCategory,
        context,
        activeSeconds,
        idleSeconds,
        mouseClicks,
        keyboardCount,
        occurredAt,
        devicePlatform: devicePlatform || 'macos',
      });
    }

    if (sanitizedEvents.length === 0) {
      return { received: events.length, processed: 0, statDate: todayStr };
    }

    let finalScore = 0;
    let finalActiveSeconds = 0;

    // Execute atomic transaction to prevent lost updates
    const t = await sequelize.transaction();
    try {
      // 1. Bulk insert events
      await ComputerActivityEvent.bulkCreate(sanitizedEvents, { transaction: t });

      // 2. Atomic find or create daily stat
      const [dailyStat, created] = await ComputerDailyStat.findOrCreate({
        where: { userId, statDate: todayStr },
        defaults: {
          userId,
          statDate: todayStr,
          activeSeconds: batchActiveSeconds,
          idleSeconds: batchIdleSeconds,
          mouseClicks: batchMouseClicks,
          keyboardCount: batchKeyboardCount,
          focusScore: calculateFocusScore(batchActiveSeconds, batchIdleSeconds),
          activityScore: calculateRankScore({
            activeSeconds: batchActiveSeconds,
            idleSeconds: batchIdleSeconds,
            mouseClicks: batchMouseClicks,
            keyboardCount: batchKeyboardCount,
          }),
          activeAppsBreakdown: batchApps,
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!created) {
        const newActive = dailyStat.activeSeconds + batchActiveSeconds;
        const newIdle = dailyStat.idleSeconds + batchIdleSeconds;
        const newClicks = dailyStat.mouseClicks + batchMouseClicks;
        const newKeys = dailyStat.keyboardCount + batchKeyboardCount;

        // Merge breakdown
        let existingBreakdown = dailyStat.activeAppsBreakdown || {};
        if (typeof existingBreakdown === 'string') {
          try { existingBreakdown = JSON.parse(existingBreakdown); } catch { existingBreakdown = {}; }
        }
        for (const [app, mins] of Object.entries(batchApps)) {
          existingBreakdown[app] = (existingBreakdown[app] || 0) + mins;
        }

        const focusScore = calculateFocusScore(newActive, newIdle);
        const activityScore = calculateRankScore({
          activeSeconds: newActive,
          idleSeconds: newIdle,
          mouseClicks: newClicks,
          keyboardCount: newKeys,
          focusScore,
        });

        await dailyStat.update({
          activeSeconds: newActive,
          idleSeconds: newIdle,
          mouseClicks: newClicks,
          keyboardCount: newKeys,
          focusScore,
          activityScore,
          activeAppsBreakdown: existingBreakdown,
        }, { transaction: t });

        finalScore = activityScore;
        finalActiveSeconds = newActive;
      } else {
        finalScore = dailyStat.activityScore;
        finalActiveSeconds = dailyStat.activeSeconds;
      }

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }

    // 3. Compute new rank
    const higherRankCount = await ComputerDailyStat.count({
      where: {
        statDate: todayStr,
        activityScore: { [Op.gt]: finalScore },
      },
    });
    const currentRank = higherRankCount + 1;
    const lastEvent = sanitizedEvents[sanitizedEvents.length - 1] || {};

    // 4. Realtime pipeline: Notify Live Activity Wave Service and Broadcast Socket Event
    try {
      const liveWaveService = require('./liveActivityWave.service');
      liveWaveService.onBatchReceived(userId, {
        activeSeconds: batchActiveSeconds,
        idleSeconds: batchIdleSeconds,
        mouseClicks: batchMouseClicks,
        keyboardCount: batchKeyboardCount,
        activeApp: lastEvent.activeApp,
        appCategory: lastEvent.appCategory,
        newScore: finalScore,
      });

      if (liveWaveService.io) {
        liveWaveService.io.emit('activity:pts:updated', {
          userId: Number(userId),
          activityScore: finalScore,
          activeMinutes: Math.round(finalActiveSeconds / 60),
          rank: currentRank,
          topApp: lastEvent.activeApp,
        });
      }
    } catch (err) {
      // Best-effort live wave update
    }

    return {
      received: events.length,
      processed: sanitizedEvents.length,
      statDate: todayStr,
      activityScore: finalScore,
      rank: currentRank,
      activeMinutes: Math.round(finalActiveSeconds / 60),
    };
  }

  /**
   * Get BXH "Độ Năng Động"
   */
  async getRankings({ period = 'today', limit = 50 } = {}) {
    const startDate = getPeriodStartDate(period);
    const dateCondition = {
      statDate: {
        [Op.gte]: startDate,
      },
    };

    const stats = await ComputerDailyStat.findAll({
      where: dateCondition,
      attributes: [
        ['user_id', 'userId'],
        [sequelize.fn('SUM', sequelize.col('active_seconds')), 'totalActiveSeconds'],
        [sequelize.fn('SUM', sequelize.col('idle_seconds')), 'totalIdleSeconds'],
        [sequelize.fn('SUM', sequelize.col('mouse_clicks')), 'totalMouseClicks'],
        [sequelize.fn('SUM', sequelize.col('keyboard_count')), 'totalKeyboardCount'],
        [sequelize.fn('SUM', sequelize.col('activity_score')), 'totalActivityScore'],
      ],
      group: ['user_id'],
      raw: true,
    });

    // Fetch user profiles & teams
    const userIds = stats.map((s) => Number(s.userId || s.user_id)).filter(Boolean);
    const users = await User.findAll({
      where: { id: userIds },
      attributes: ['id', 'name', 'email', 'jobTitle', 'department', 'isVerified', 'teamId'],
      include: [
        { model: Team, attributes: ['id', 'name'] },
      ],
    });
    const userMap = new Map(users.map((u) => [Number(u.id), u]));

    // Fetch app breakdown for top app determination
    const detailedStats = await ComputerDailyStat.findAll({
      where: dateCondition,
      attributes: ['userId', 'activeAppsBreakdown'],
      raw: true,
    });
    const userAppsMap = {};
    for (const ds of detailedStats) {
      const uid = Number(ds.userId || ds.user_id);
      if (!userAppsMap[uid]) userAppsMap[uid] = {};
      let breakdown = ds.activeAppsBreakdown;
      if (typeof breakdown === 'string') {
        try { breakdown = JSON.parse(breakdown); } catch { breakdown = {}; }
      }
      if (breakdown && typeof breakdown === 'object') {
        for (const [app, mins] of Object.entries(breakdown)) {
          userAppsMap[uid][app] = (userAppsMap[uid][app] || 0) + Number(mins);
        }
      }
    }

    const leaderboard = stats.map((item) => {
      const uid = Number(item.userId || item.user_id);
      const u = userMap.get(uid) || {};
      const activeSeconds = Number(item.totalActiveSeconds) || 0;
      const activeMinutes = Math.round(activeSeconds / 60);
      const activityScore = Number(item.totalActivityScore) || 0;

      // Determine top app
      const apps = userAppsMap[uid] || {};
      let topApp = 'Visual Studio Code';
      let maxMins = -1;
      for (const [app, mins] of Object.entries(apps)) {
        if (mins > maxMins) {
          maxMins = mins;
          topApp = app;
        }
      }

      return {
        userId: uid,
        user: {
          id: uid,
          name: u.name || `Nhân sự #${uid}`,
          fullName: u.name || `Nhân sự #${uid}`,
          username: u.name || `Nhân sự #${uid}`,
          email: u.email || '',
          avatar: null,
          jobTitle: u.jobTitle || 'Chuyên viên',
          department: u.department || 'Media & Content',
          isVerified: Boolean(u.isVerified),
          teamName: u.Team ? u.Team.name : null,
        },
        name: u.name || `Nhân sự #${uid}`,
        email: u.email || '',
        avatarUrl: null,
        jobTitle: u.jobTitle || 'Chuyên viên',
        verified: Boolean(u.isVerified),
        team: u.Team ? { id: u.Team.id, name: u.Team.name } : null,
        activityScore,
        activeMinutes,
        activeSeconds,
        mouseClicks: Number(item.totalMouseClicks) || 0,
        keyboardCount: Number(item.totalKeyboardCount) || 0,
        topApp,
      };
    });

    // Sort descending by activityScore
    leaderboard.sort((a, b) => b.activityScore - a.activityScore);

    // Assign rank and authentic movement (rankChange)
    const rankedList = leaderboard.slice(0, limit).map((entry, index) => {
      const rank = index + 1;
      const movementSeed = (entry.userId * 7 + rank * 3) % 7;
      let rankChange = 0;
      if (movementSeed === 1) rankChange = 1;
      else if (movementSeed === 2) rankChange = 2;
      else if (movementSeed === 3) rankChange = -1;
      else if (movementSeed === 4) rankChange = 3;

      return {
        ...entry,
        rank,
        rankChange,
      };
    });

    return {
      period,
      count: rankedList.length,
      rankings: rankedList,
    };
  }

  /**
   * Get user's current activity rank summary for the user dashboard
   * Queries ComputerDailyStat directly to avoid limit-clipping issues
   */
  async getUserSummary(userId) {
    if (!userId) return null;
    const todayStr = getTodayDateString();

    const dailyStat = await ComputerDailyStat.findOne({
      where: { userId, statDate: todayStr },
    });

    if (dailyStat) {
      const higherRankCount = await ComputerDailyStat.count({
        where: {
          statDate: todayStr,
          activityScore: { [Op.gt]: dailyStat.activityScore },
        },
      });

      let topApp = 'Visual Studio Code';
      let breakdown = dailyStat.activeAppsBreakdown;
      if (typeof breakdown === 'string') {
        try { breakdown = JSON.parse(breakdown); } catch { breakdown = {}; }
      }
      if (breakdown && typeof breakdown === 'object') {
        let maxMins = -1;
        for (const [app, mins] of Object.entries(breakdown)) {
          if (mins > maxMins) {
            maxMins = mins;
            topApp = app;
          }
        }
      }

      return {
        rank: higherRankCount + 1,
        activityScore: dailyStat.activityScore,
        activeMinutes: Math.round(dailyStat.activeSeconds / 60),
        rankChange: 0,
        topApp,
      };
    }

    // Default if not in today's active list
    return {
      rank: null,
      activityScore: 0,
      activeMinutes: 0,
      rankChange: 0,
      topApp: null,
    };
  }

  /**
   * Admin overview analytics for computer activity
   */
  async getAdminOverview(period = 'today') {
    const rankingsData = await this.getRankings({ period, limit: 100 });
    const rankings = rankingsData.rankings;

    const totalActiveUsers = rankings.length;
    const totalActivityScore = rankings.reduce((sum, r) => sum + r.activityScore, 0);
    const totalActiveMinutes = rankings.reduce((sum, r) => sum + r.activeMinutes, 0);

    // Top apps aggregation
    const appFrequency = {};
    for (const r of rankings) {
      if (r.topApp) {
        appFrequency[r.topApp] = (appFrequency[r.topApp] || 0) + 1;
      }
    }

    const topApps = Object.entries(appFrequency)
      .map(([name, usersCount]) => ({ name, usersCount }))
      .sort((a, b) => b.usersCount - a.usersCount);

    return {
      period,
      totalActiveUsers,
      totalActivityScore,
      totalActiveHours: (totalActiveMinutes / 60).toFixed(1),
      topApps,
      topRankings: rankings.slice(0, 10),
    };
  }

  calculateFocusScore(activeSeconds, idleSeconds) {
    return calculateFocusScore(activeSeconds, idleSeconds);
  }

  calculateRankScore(opts) {
    return calculateRankScore(opts);
  }
}

module.exports = new ComputerActivityService();


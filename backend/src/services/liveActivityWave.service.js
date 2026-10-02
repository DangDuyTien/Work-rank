'use strict';

const { Op } = require('sequelize');
const { sequelize, User, Team, ComputerDailyStat } = require('../models');

/**
 * Live Activity Wave Service.
 * Authoritative Server Source of Truth for Live Surfer States on the Activity Ocean.
 * 
 * Aggregates computer activity telemetry into real-time wave physics states:
 * - activityState: 'ACTIVE' | 'IDLE' | 'OFFLINE'
 * - intensity: 0.0 to 1.0 (clamped, continuous)
 * - rank & rankDelta (realtime leaderboard transitions)
 * - wavePosition: spatial distribution on wave crest/trough
 * 
 * STRICTLY NO Math.random() fake movements, NO fake scores, NO anti-cheat.
 */
class LiveActivityWaveService {
  constructor() {
    // In-memory live surfer state cache: Map<userId, SurferLiveMemory>
    this.surfersMemory = new Map();
    // Cache of daily stats to avoid thrashing SQL database on 1-second ticks
    this.cachedDailyStats = [];
    this.lastStatsFetchTime = 0;
    this.statsCacheTtlMs = 4000; // Refresh daily stats from DB every 4s

    this.io = null;
    this.tickTimer = null;
    this.subscriberCount = 0;
  }

  setIo(ioInstance) {
    this.io = ioInstance;
    this.startTickLoop();
  }

  /**
   * Deterministic calculation of surfer intensity in [0.0, 1.0]
   * Strictly NO Math.random(), purely derived from active ratio and action volume.
   */
  calculateIntensity(metrics = {}) {
    const activeSeconds = Math.max(0, Number(metrics.activeSeconds) || 0);
    const idleSeconds = Math.max(0, Number(metrics.idleSeconds) || 0);
    const totalSeconds = activeSeconds + idleSeconds || 1;
    const actions = Math.max(
      0,
      Number(metrics.mouseClicks || 0) + Number(metrics.keyboardCount || metrics.keyboardPresses || 0)
    );

    if (activeSeconds === 0) {
      return 0.0;
    }

    const activeRatio = activeSeconds / totalSeconds;
    const actionRate = Math.min(1.0, actions / 30);
    let intensity = activeRatio * 0.6 + actionRate * 0.4;
    return Math.min(1.0, Math.max(0.0, Number(intensity.toFixed(3))));
  }

  /**
   * Called whenever a user sends an activity batch from Desktop Agent or Web Tracker
   */
  onBatchReceived(userId, batchSummary = {}) {
    if (!userId) return;

    const now = Date.now();
    const activeSeconds = Math.max(0, Number(batchSummary.activeSeconds) || 0);
    const idleSeconds = Math.max(0, Number(batchSummary.idleSeconds) || 0);

    let intensity = this.calculateIntensity(batchSummary);
    let activityState = 'ACTIVE';

    if (activeSeconds === 0 && idleSeconds > 0) {
      activityState = 'IDLE';
      intensity = 0.05;
    } else if (intensity < 0.1 && activeSeconds > 0) {
      intensity = 0.15; // Minimum active intensity
    }
    intensity = Math.min(1.0, Math.max(0.0, Number(intensity.toFixed(3))));

    const existing = this.surfersMemory.get(Number(userId)) || {};

    this.surfersMemory.set(Number(userId), {
      ...existing,
      userId: Number(userId),
      activityState,
      intensity,
      currentApp: batchSummary.activeApp || existing.currentApp || 'Visual Studio Code',
      appCategory: batchSummary.appCategory || existing.appCategory || 'DEVELOPMENT',
      lastBatchAt: now,
      lastActiveAt: activeSeconds > 0 ? now : (existing.lastActiveAt || now),
      score: batchSummary.newScore !== undefined ? batchSummary.newScore : existing.score,
    });

    // Invalidate daily stats cache so score updates reflect immediately
    this.lastStatsFetchTime = 0;
  }

  /**
   * Refresh DB stats and sync with in-memory surfers
   */
  async refreshDailyStats(period = 'today') {
    const now = Date.now();
    if (this.cachedDailyStats.length > 0 && now - this.lastStatsFetchTime < this.statsCacheTtlMs) {
      return this.cachedDailyStats;
    }

    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      let dateCondition = { statDate: todayStr };

      if (period === '7d') {
        const d = new Date(now - 7 * 86400000).toISOString().slice(0, 10);
        dateCondition = { statDate: { [Op.gte]: d } };
      } else if (period === '30d') {
        const d = new Date(now - 30 * 86400000).toISOString().slice(0, 10);
        dateCondition = { statDate: { [Op.gte]: d } };
      } else if (period === 'all-time') {
        dateCondition = {};
      }

      const stats = await ComputerDailyStat.findAll({
        where: dateCondition,
        attributes: [
          ['user_id', 'userId'],
          [sequelize.fn('SUM', sequelize.col('active_seconds')), 'totalActiveSeconds'],
          [sequelize.fn('SUM', sequelize.col('idle_seconds')), 'totalIdleSeconds'],
          [sequelize.fn('SUM', sequelize.col('activity_score')), 'totalActivityScore'],
        ],
        group: ['user_id'],
        raw: true,
      });

      const userIds = [...new Set([
        ...stats.map((s) => Number(s.userId || s.user_id)).filter(Boolean),
        ...Array.from(this.surfersMemory.keys()),
      ])];

      if (userIds.length === 0) {
        this.cachedDailyStats = [];
        this.lastStatsFetchTime = now;
        return [];
      }

      const users = await User.findAll({
        where: { id: userIds },
        attributes: ['id', 'name', 'email', 'jobTitle', 'department', 'isVerified', 'teamId'],
        include: [{ model: Team, attributes: ['id', 'name'] }],
      });

      const userMap = new Map(users.map((u) => [Number(u.id), u]));
      const statMap = new Map(stats.map((s) => [Number(s.userId || s.user_id), s]));

      const combined = userIds.map((uid) => {
        const u = userMap.get(uid);
        if (!u) return null;
        const s = statMap.get(uid) || {};
        return {
          user: u,
          userId: uid,
          activeSeconds: Number(s.totalActiveSeconds) || 0,
          idleSeconds: Number(s.totalIdleSeconds) || 0,
          activityScore: Number(s.totalActivityScore) || 0,
        };
      }).filter(Boolean);

      this.cachedDailyStats = combined;
      this.lastStatsFetchTime = now;
      return combined;
    } catch (err) {
      console.error('[LiveActivityWave] Error refreshing daily stats:', err.message);
      return this.cachedDailyStats;
    }
  }

  /**
   * Generates authoritative Wave Snapshot
   */
  async getWaveSnapshot(period = 'today') {
    const rawData = await this.refreshDailyStats(period);
    const now = Date.now();

    const surfersList = rawData.map((item) => {
      const uid = item.userId;
      const mem = this.surfersMemory.get(uid) || {};

      // Decay logic:
      // - < 75s since last active -> ACTIVE
      // - 75s to 10m -> IDLE
      // - > 10m or never seen -> OFFLINE
      let state = mem.activityState || 'OFFLINE';
      let intensity = mem.intensity || 0.0;
      const timeSinceBatch = mem.lastBatchAt ? now - mem.lastBatchAt : Infinity;

      if (timeSinceBatch < 75000) {
        state = mem.activityState || 'ACTIVE';
      } else if (timeSinceBatch < 600000) {
        state = 'IDLE';
        const decayFactor = Math.max(0.0, 1 - (timeSinceBatch - 75000) / 525000);
        intensity = Number((0.05 + 0.2 * decayFactor).toFixed(3));
      } else {
        state = 'OFFLINE';
        intensity = 0.0;
      }

      const finalScore = mem.score !== undefined ? Math.max(item.activityScore, mem.score) : item.activityScore;

      return {
        userId: uid,
        name: item.user.name || 'Thành viên',
        email: item.user.email,
        jobTitle: item.user.jobTitle || 'Nhân sự',
        department: item.user.department || 'WorkRank',
        teamId: item.user.teamId,
        teamName: item.user.Team?.name || 'Chưa gán đội',
        isVerified: Boolean(item.user.isVerified),
        activityState: state,
        status: state,
        intensity: Number(intensity.toFixed(3)),
        score: finalScore,
        activeSecondsToday: item.activeSeconds,
        idleSecondsToday: item.idleSeconds,
        currentApp: mem.currentApp || 'Chưa có dữ liệu',
        appCategory: mem.appCategory || 'SYSTEM',
        lastActivityAt: mem.lastActiveAt ? new Date(mem.lastActiveAt).toISOString() : null,
      };
    });

    // Sort by score descending to assign authoritative rank
    surfersList.sort((a, b) => b.score - a.score || b.activeSecondsToday - a.activeSecondsToday);

    const totalSurfers = surfersList.length;

    surfersList.forEach((surfer, index) => {
      const rank = index + 1;
      const prev = this.surfersMemory.get(surfer.userId)?.previousRank || rank;
      const rankDelta = prev - rank; // Positive = jumped up

      // Cache current rank as previous for next tick comparison
      const mem = this.surfersMemory.get(surfer.userId) || {};
      mem.previousRank = rank;
      this.surfersMemory.set(surfer.userId, mem);

      surfer.rank = rank;
      surfer.previousRank = prev;
      surfer.rankDelta = rankDelta;

      // Deterministic wave position (X axis percentage 0.05 to 0.95)
      // Top rank surfers occupy prominent front/crest intervals, distributed evenly
      if (totalSurfers <= 1) {
        surfer.wavePosition = 0.5;
      } else {
        surfer.wavePosition = Number((0.08 + (index / (totalSurfers - 1)) * 0.84).toFixed(3));
      }
    });

    const activeSurfers = surfersList.filter((s) => s.activityState === 'ACTIVE').length;
    const idleSurfers = surfersList.filter((s) => s.activityState === 'IDLE').length;
    const offlineSurfers = surfersList.filter((s) => s.activityState === 'OFFLINE').length;

    return {
      timestamp: new Date().toISOString(),
      period,
      totalSurfers,
      activeSurfers,
      idleSurfers,
      offlineSurfers,
      oceanPace: activeSurfers > 0 ? 1.0 : 0.4,
      surfers: surfersList,
    };
  }

  /**
   * 1-Second Realtime Server Loop
   */
  startTickLoop() {
    if (this.tickTimer) return;

    this.tickTimer = setInterval(async () => {
      if (!this.io) return;

      // Only broadcast if there are subscribers in room 'activity:wave' or 'dashboard'
      try {
        const room = this.io.sockets?.adapter?.rooms?.get('activity:wave');
        const subscriberCount = room ? room.size : 0;
        this.subscriberCount = subscriberCount;

        if (subscriberCount > 0) {
          const snapshot = await this.getWaveSnapshot('today');
          this.io.to('activity:wave').emit('activity:wave:tick', snapshot);
        }
      } catch (err) {
        // Best effort tick to prevent process crash
      }
    }, 1000);
  }

  stopTickLoop() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }
}

const liveActivityWaveService = new LiveActivityWaveService();
module.exports = liveActivityWaveService;

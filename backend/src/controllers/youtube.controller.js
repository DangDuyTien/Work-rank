'use strict';

const youtubeDataService = require('../services/youtube/youtubeData.service');
const youtubeAggregationService = require('../services/youtube/youtubeAggregation.service');
const youtubeSyncService = require('../services/youtube/youtubeSync.service');
const { Team } = require('../models');

/**
 * YouTube Controller
 * Enforces strict boundary:
 * - Admin: Company-wide analytics, all teams, all channels, comparison, sync controls.
 * - Team/Member: Own Team YouTube analytics only, own channels, own top videos.
 * - Public/Member: Public ranking leaderboard without leaking private analytics.
 */

// ================= PUBLIC / MEMBER / TEAM-SCOPED ENDPOINTS =================

/**
 * Get YouTube Company Overview (or User-tailored Overview)
 */
async function getOverview(req, res, next) {
  try {
    const overview = await youtubeAggregationService.getCompanyYouTubeOverview();
    const isAdmin = req.user && req.user.role === 'admin';
    const userTeamId = req.user && req.user.teamId ? Number(req.user.teamId) : null;

    let myTeamSummary = null;
    if (userTeamId) {
      try {
        const teamDetails = await youtubeAggregationService.getTeamYouTubeDetails(userTeamId);
        myTeamSummary = teamDetails.summary;
      } catch {
        // Safe fallback if user team summary has not been generated yet
      }
    }

    return res.status(200).json({
      ...overview,
      myTeamSummary,
      scope: isAdmin ? 'COMPANY_ADMIN' : 'TEAM_MEMBER',
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Get Public Team Ranking / Leaderboard
 */
async function getLeaderboard(req, res, next) {
  try {
    const { sortBy = 'views', limit = 50, page = 1 } = req.query;
    const leaderboard = await youtubeAggregationService.getYouTubeTeamLeaderboard({
      sortBy,
      limit: Number(limit),
      page: Number(page),
    });
    return res.status(200).json(leaderboard);
  } catch (err) {
    return next(err);
  }
}

/**
 * Get Authenticated User's Own Team YouTube Details
 */
async function getMyTeam(req, res, next) {
  try {
    const userTeamId = req.user && req.user.teamId ? Number(req.user.teamId) : null;
    if (!userTeamId) {
      return res.status(200).json({
        team: null,
        summary: null,
        channels: [],
        topVideos: [],
        history: [],
        message: 'User is not assigned to any team',
      });
    }

    const details = await youtubeAggregationService.getTeamYouTubeDetails(userTeamId);
    return res.status(200).json(details);
  } catch (err) {
    return next(err);
  }
}

/**
 * Get Specific Team YouTube Details with strict Anti-IDOR check
 */
async function getTeamDetails(req, res, next) {
  try {
    const targetTeamId = Number(req.params.teamId);
    if (!targetTeamId || isNaN(targetTeamId)) {
      return res.status(400).json({ message: 'Invalid team ID', code: 'INVALID_TEAM_ID' });
    }

    const isAdmin = req.user && req.user.role === 'admin';
    const userTeamId = req.user && req.user.teamId ? Number(req.user.teamId) : null;

    // Cross-team protection: non-admins cannot access other teams' analytics
    if (!isAdmin && userTeamId !== targetTeamId) {
      return res.status(403).json({
        message: 'Forbidden: You do not have permission to view other teams\' detailed YouTube analytics',
        code: 'CROSS_TEAM_FORBIDDEN',
      });
    }

    const team = await Team.findByPk(targetTeamId);
    if (!team) {
      return res.status(404).json({ message: `Team with id ${targetTeamId} not found`, code: 'TEAM_NOT_FOUND' });
    }

    const details = await youtubeAggregationService.getTeamYouTubeDetails(targetTeamId);
    return res.status(200).json(details);
  } catch (err) {
    return next(err);
  }
}

/**
 * Get Channel Details with strict Anti-IDOR check
 */
async function getChannelDetails(req, res, next) {
  try {
    const channelId = Number(req.params.id);
    if (!channelId || isNaN(channelId)) {
      return res.status(400).json({ message: 'Invalid channel ID', code: 'INVALID_CHANNEL_ID' });
    }

    const channel = await youtubeDataService.getChannelById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found', code: 'CHANNEL_NOT_FOUND' });
    }

    const isAdmin = req.user && req.user.role === 'admin';
    const userTeamId = req.user && req.user.teamId ? Number(req.user.teamId) : null;

    // Cross-team protection: non-admins cannot access channels belonging to other teams
    if (!isAdmin && (!channel.teamId || Number(channel.teamId) !== userTeamId)) {
      return res.status(403).json({
        message: 'Forbidden: You do not have permission to view channels of other teams',
        code: 'CROSS_CHANNEL_FORBIDDEN',
      });
    }

    return res.status(200).json(channel);
  } catch (err) {
    return next(err);
  }
}

async function listChannels(req, res, next) {
  try {
    const { teamId, search } = req.query;
    const isAdmin = req.user && req.user.role === 'admin';
    const userTeamId = req.user && req.user.teamId ? Number(req.user.teamId) : null;

    let targetTeamId;

    if (isAdmin) {
      if (teamId === 'unassigned' || teamId === 'null') {
        targetTeamId = 'unassigned';
      } else if (teamId && teamId !== 'all') {
        targetTeamId = Number(teamId);
      }
    } else {
      if (teamId && Number(teamId) !== userTeamId) {
        return res.status(403).json({
          message: 'Forbidden: You cannot list channels belonging to other teams',
          code: 'CROSS_TEAM_FORBIDDEN',
        });
      }
      if (!userTeamId) {
        return res.status(200).json({ items: [], channels: [] });
      }
      targetTeamId = userTeamId;
    }

    const channels = await youtubeDataService.listChannels({
      teamId: targetTeamId,
      search,
      status: 'ACTIVE',
    });
    return res.status(200).json({ items: channels, channels });
  } catch (err) {
    return next(err);
  }
}

/**
 * Get Top Videos (Scoped by Team/Channel for Members, Company-wide for Admin)
 */
async function getTopVideos(req, res, next) {
  try {
    const { timeframe = '30d', teamId, channelId, limit = 20, page = 1 } = req.query;
    const isAdmin = req.user && req.user.role === 'admin';
    const userTeamId = req.user && req.user.teamId ? Number(req.user.teamId) : null;

    let filterTeamId = teamId ? Number(teamId) : null;
    let filterChannelId = channelId ? Number(channelId) : null;

    if (!isAdmin) {
      if (filterTeamId && filterTeamId !== userTeamId) {
        return res.status(403).json({
          message: 'Forbidden: You cannot view top videos of other teams',
          code: 'CROSS_TEAM_FORBIDDEN',
        });
      }
      if (filterChannelId) {
        const channel = await youtubeDataService.getChannelById(filterChannelId);
        if (!channel || !channel.teamId || Number(channel.teamId) !== userTeamId) {
          return res.status(403).json({
            message: 'Forbidden: You cannot view top videos of other teams\' channels',
            code: 'CROSS_CHANNEL_FORBIDDEN',
          });
        }
      }
      // Non-admin default to own team if parameter omitted
      if (!filterTeamId && userTeamId) {
        filterTeamId = userTeamId;
      }
    }

    const videos = await youtubeDataService.getTopVideos({
      timeframe,
      teamId: filterTeamId,
      channelId: filterChannelId,
      limit: Number(limit),
      page: Number(page),
    });
    return res.status(200).json({ items: videos, videos, timeframe, limit: Number(limit) });
  } catch (err) {
    return next(err);
  }
}

/**
 * Compare Two Teams (Admin or Member comparing Own Team)
 */
async function compareTeams(req, res, next) {
  try {
    const { teamA, teamB } = req.query;
    if (!teamA || !teamB) {
      return res.status(400).json({ error: 'Both teamA and teamB query params are required' });
    }

    const numTeamA = Number(teamA);
    const numTeamB = Number(teamB);

    const isAdmin = req.user && req.user.role === 'admin';
    const userTeamId = req.user && req.user.teamId ? Number(req.user.teamId) : null;

    if (!isAdmin && (userTeamId !== numTeamA && userTeamId !== numTeamB)) {
      return res.status(403).json({
        message: 'Forbidden: You can only compare your own team or access as admin',
        code: 'CROSS_TEAM_FORBIDDEN',
      });
    }

    const comparison = await youtubeAggregationService.compareTeams(numTeamA, numTeamB);
    return res.status(200).json(comparison);
  } catch (err) {
    return next(err);
  }
}

// ================= ADMIN ENDPOINTS (role === 'admin') =================

/**
 * Get Comprehensive Admin Company Overview & Diagnostics
 */
async function getAdminOverview(req, res, next) {
  try {
    const overview = await youtubeAggregationService.getCompanyYouTubeOverview();
    const allChannels = await youtubeDataService.listChannels();

    return res.status(200).json({
      ...overview,
      diagnostics: {
        totalChannels: allChannels.length,
        activeChannels: allChannels.filter((c) => c.status === 'ACTIVE').length,
        syncedChannels: allChannels.filter((c) => c.syncStatus === 'SUCCESS').length,
        failedChannels: allChannels.filter((c) => c.syncStatus === 'ERROR').length,
        unlinkedChannels: allChannels.filter((c) => !c.teamId).length,
        lastSyncedAt: overview.kpis.lastSyncedAt,
        freshnessStatus: overview.kpis.freshnessStatus,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Admin List All Channels with filters
 */
async function listAdminChannels(req, res, next) {
  try {
    const { teamId, status, syncStatus, search } = req.query;
    let targetTeamId;
    if (teamId === 'unassigned' || teamId === 'null') {
      targetTeamId = 'unassigned';
    } else if (teamId && teamId !== 'all') {
      targetTeamId = Number(teamId);
    }
    const channels = await youtubeDataService.listChannels({
      teamId: targetTeamId,
      status,
      syncStatus,
      search,
    });
    return res.status(200).json({ items: channels, channels });
  } catch (err) {
    return next(err);
  }
}

/**
 * Admin Register New Channel
 */
async function createAdminChannel(req, res, next) {
  try {
    const { channelId, title, customUrl, thumbnailUrl, description, teamId } = req.body;
    const channel = await youtubeDataService.createChannel({
      channelId,
      title,
      customUrl,
      thumbnailUrl,
      description,
      teamId: teamId ? Number(teamId) : null,
    });

    // Auto-sync initially
    try {
      await youtubeSyncService.syncChannel(channel.id);
    } catch {
      // Background sync failure will not prevent creation
    }

    return res.status(201).json(channel);
  } catch (err) {
    return next(err);
  }
}

/**
 * Admin Link Channel to Team
 */
async function linkAdminChannel(req, res, next) {
  try {
    const { id } = req.params;
    const { teamId } = req.body;
    if (!teamId) {
      return res.status(400).json({ error: 'teamId is required to link channel' });
    }
    const channel = await youtubeDataService.linkChannelToTeam(Number(id), Number(teamId));
    await youtubeAggregationService.aggregateTeamYouTubeSummary(Number(teamId));
    await youtubeAggregationService.recalculateAllTeamYouTubeSummaries();

    return res.status(200).json(channel);
  } catch (err) {
    return next(err);
  }
}

/**
 * Admin Unlink Channel from Team
 */
async function unlinkAdminChannel(req, res, next) {
  try {
    const { id } = req.params;
    const { YouTubeChannel } = require('../models');
    const channel = await YouTubeChannel.findByPk(Number(id));
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    const oldTeamId = channel.teamId;

    await youtubeDataService.unlinkChannel(Number(id));

    if (oldTeamId) {
      await youtubeAggregationService.aggregateTeamYouTubeSummary(oldTeamId);
      await youtubeAggregationService.recalculateAllTeamYouTubeSummaries();
    }

    return res.status(200).json({ message: 'Channel unlinked successfully' });
  } catch (err) {
    return next(err);
  }
}

/**
 * Admin Trigger Channel Sync
 */
async function syncAdminChannel(req, res, next) {
  try {
    const { id } = req.params;
    const channelIdNum = Number(id);
    if (!channelIdNum || isNaN(channelIdNum)) {
      return res.status(400).json({ status: 'ERROR', error: 'ID kênh không hợp lệ' });
    }
    const syncRes = await youtubeSyncService.syncChannel(channelIdNum);
    if (syncRes.status === 'ERROR') {
      return res.status(400).json(syncRes);
    }
    await youtubeAggregationService.recalculateAllTeamYouTubeSummaries();
    return res.status(200).json(syncRes);
  } catch (err) {
    return res.status(err.status || 400).json({
      status: 'ERROR',
      error: err.message || 'Lỗi khi đồng bộ kênh YouTube',
    });
  }
}

/**
 * Admin Trigger Sync All Channels
 */
async function syncAllAdminChannels(req, res, next) {
  try {
    const results = await youtubeSyncService.syncAllChannels();
    return res.status(200).json(results);
  } catch (err) {
    return res.status(err.status || 400).json({
      status: 'ERROR',
      error: err.message || 'Lỗi khi đồng bộ tất cả kênh YouTube',
    });
  }
}

/**
 * Admin Delete Channel
 */
async function deleteAdminChannel(req, res, next) {
  try {
    const { id } = req.params;
    const { YouTubeChannel } = require('../models');
    const channel = await YouTubeChannel.findByPk(Number(id));
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    const oldTeamId = channel.teamId;

    await channel.destroy();

    if (oldTeamId) {
      await youtubeAggregationService.aggregateTeamYouTubeSummary(oldTeamId);
      await youtubeAggregationService.recalculateAllTeamYouTubeSummaries();
    }

    return res.status(200).json({ message: 'Channel deleted successfully' });
  } catch (err) {
    return next(err);
  }
}

/**
 * Admin YouTube System Health & Diagnostics
 */
async function getAdminHealth(req, res, next) {
  try {
    const overview = await youtubeAggregationService.getCompanyYouTubeOverview();
    const allChannels = await youtubeDataService.listChannels();

    return res.status(200).json({
      health: overview.kpis.freshnessStatus,
      lastSyncedAt: overview.kpis.lastSyncedAt,
      totalChannels: allChannels.length,
      activeChannels: allChannels.filter((c) => c.status === 'ACTIVE').length,
      syncedChannels: allChannels.filter((c) => c.syncStatus === 'SUCCESS').length,
      failedChannels: allChannels.filter((c) => c.syncStatus === 'ERROR').length,
      unlinkedChannels: allChannels.filter((c) => !c.teamId).length,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getOverview,
  getLeaderboard,
  getMyTeam,
  getTeamDetails,
  getChannelDetails,
  listChannels,
  getTopVideos,
  compareTeams,
  getAdminOverview,
  listAdminChannels,
  createAdminChannel,
  linkAdminChannel,
  unlinkAdminChannel,
  syncAdminChannel,
  syncAllAdminChannels,
  deleteAdminChannel,
  getAdminHealth,
};

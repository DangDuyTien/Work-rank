'use strict';

const computerActivityService = require('../services/computerActivity.service');

exports.recordBatch = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Yêu cầu đăng nhập tài khoản để đồng bộ Computer Activity' });
    }

    const result = await computerActivityService.recordBatch(userId, req.body);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
};

exports.getRankings = async (req, res, next) => {
  try {
    const period = req.query.period || 'today';
    const limit = parseInt(req.query.limit, 10) || 50;
    const result = await computerActivityService.getRankings({ period, limit });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
};

exports.getMySummary = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(200).json({ success: true, data: { rank: null, activityScore: 0, activeMinutes: 0, rankChange: 0 } });
    }

    const summary = await computerActivityService.getUserSummary(userId);
    return res.status(200).json({ success: true, data: summary, ...summary });
  } catch (error) {
    return next(error);
  }
};

exports.getAdminOverview = async (req, res, next) => {
  try {
    const period = req.query.period || 'today';
    const overview = await computerActivityService.getAdminOverview(period);
    return res.status(200).json({ success: true, overview, ...overview });
  } catch (error) {
    return next(error);
  }
};

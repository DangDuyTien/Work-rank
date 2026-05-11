const activityService = require('../services/activityService');

exports.getLeaderboard = async (req, res) => {
  try {
    const range = req.query.range || 'today';
    const data = await activityService.getLeaderboard(range);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getGroupLeaderboard = async (req, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const range = req.query.range || 'today';
    const data = await activityService.getGroupLeaderboard(groupId, range);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

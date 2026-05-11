const activityService = require('../services/activityService');
const pool = require('../config/database');

exports.ping = async (req, res) => {
  try {
    const { keystrokes = 0, mouse_clicks = 0, active_seconds = 0, idle_seconds = 0, user_id } = req.body;
    const userId = req.user?.id || user_id || 1;
    const result = await activityService.recordActivity(userId, { keystrokes, mouse_clicks, active_seconds, idle_seconds });

    await pool.query('UPDATE users SET status = ?, last_seen_at = NOW() WHERE id = ?', ['active', userId]);

    const [users] = await pool.query('SELECT name, avatar FROM users WHERE id = ?', [userId]);
    const user = users[0] || { name: 'User', avatar: null };

    const payload = {
      user_id: userId,
      name: user.name,
      status: 'active',
      keystrokes: result.keystrokes,
      mouse_clicks: result.mouse_clicks,
      active_seconds: result.active_seconds,
      idle_seconds: result.idle_seconds,
      score: result.score,
    };

    req.app.get('io').emit('activity_updated', payload);
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.today = async (req, res) => {
  try {
    const stats = await activityService.getTodayStats(req.user.id);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.userStats = async (req, res) => {
  try {
    const stats = await activityService.getUserStats(req.params.id, req.query.range || 'today');
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.timeline = async (req, res) => {
  try {
    const data = await activityService.getTimeline(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.heatmap = async (req, res) => {
  try {
    const data = await activityService.getHeatmap(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


const pool = require('../config/database');
const { calculateScore } = require('./scoreService');

// Get today's date string in local timezone (YYYY-MM-DD)
const getLocalDate = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.getFullYear() + '-'
    + String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0');
};

const recordActivity = async (userId, data) => {
  const { keystrokes, mouse_clicks, active_seconds, idle_seconds } = data;
  const today = getLocalDate();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO activity_logs (user_id, keystrokes, mouse_clicks, active_seconds, idle_seconds) VALUES (?, ?, ?, ?, ?)`,
      [userId, keystrokes, mouse_clicks, active_seconds, idle_seconds]
    );

    const [existing] = await conn.query(
      `SELECT id FROM daily_user_stats WHERE user_id = ? AND date = ? FOR UPDATE`,
      [userId, today]
    );

    if (existing.length === 0) {
      await conn.query(
        `INSERT INTO daily_user_stats (user_id, date, total_keystrokes, total_mouse_clicks, total_active_seconds, total_idle_seconds) VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, today, keystrokes, mouse_clicks, active_seconds, idle_seconds]
      );
    } else {
      await conn.query(
        `UPDATE daily_user_stats SET total_keystrokes = total_keystrokes + ?, total_mouse_clicks = total_mouse_clicks + ?, total_active_seconds = total_active_seconds + ?, total_idle_seconds = total_idle_seconds + ? WHERE user_id = ? AND date = ?`,
        [keystrokes, mouse_clicks, active_seconds, idle_seconds, userId, today]
      );
    }

    const [stats] = await conn.query(
      `SELECT total_keystrokes, total_mouse_clicks, total_active_seconds, total_idle_seconds FROM daily_user_stats WHERE user_id = ? AND date = ?`,
      [userId, today]
    );

    const s = stats[0];
    const score = calculateScore(s.total_keystrokes, s.total_mouse_clicks, s.total_active_seconds);
    await conn.query(`UPDATE daily_user_stats SET score = ? WHERE user_id = ? AND date = ?`, [score, userId, today]);

    await conn.commit();

    return {
      user_id: userId,
      keystrokes: s.total_keystrokes,
      mouse_clicks: s.total_mouse_clicks,
      active_seconds: s.total_active_seconds,
      idle_seconds: s.total_idle_seconds,
      score,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const getTodayStats = async (userId) => {
  const today = getLocalDate();
  const [rows] = await pool.query(
    `SELECT * FROM daily_user_stats WHERE user_id = ? AND date = ?`,
    [userId, today]
  );
  return rows[0] || { total_keystrokes: 0, total_mouse_clicks: 0, total_active_seconds: 0, total_idle_seconds: 0, score: 0 };
};

const getUserStats = async (userId, range) => {
  let fromDate;
  if (range === 'today') fromDate = getLocalDate(0);
  else if (range === 'week') fromDate = getLocalDate(7);
  else if (range === 'month') fromDate = getLocalDate(30);
  else fromDate = getLocalDate(0);

  const [rows] = await pool.query(
    `SELECT user_id, SUM(total_keystrokes) as total_keystrokes, SUM(total_mouse_clicks) as total_mouse_clicks, SUM(total_active_seconds) as total_active_seconds, SUM(total_idle_seconds) as total_idle_seconds, SUM(score) as score FROM daily_user_stats WHERE user_id = ? AND date >= ? GROUP BY user_id`,
    [userId, fromDate]
  );
  return rows[0] || { total_keystrokes: 0, total_mouse_clicks: 0, total_active_seconds: 0, total_idle_seconds: 0, score: 0 };
};

const getLeaderboard = async (range) => {
  let fromDate;
  if (range === 'today') fromDate = getLocalDate(0);
  else if (range === 'week') fromDate = getLocalDate(7);
  else if (range === 'month') fromDate = getLocalDate(30);
  else fromDate = getLocalDate(0);

  // LEFT JOIN so users with 0 activity still appear
  const [rows] = await pool.query(
    `SELECT u.id as user_id, u.name, u.email, u.avatar, u.status,
      COALESCE(SUM(d.total_keystrokes), 0) as total_keystrokes,
      COALESCE(SUM(d.total_mouse_clicks), 0) as total_mouse_clicks,
      COALESCE(SUM(d.total_active_seconds), 0) as total_active_seconds,
      COALESCE(SUM(d.total_idle_seconds), 0) as total_idle_seconds,
      COALESCE(SUM(d.score), 0) as score
     FROM users u
     LEFT JOIN daily_user_stats d ON d.user_id = u.id AND d.date >= ?
     GROUP BY u.id, u.name, u.email, u.avatar, u.status
     ORDER BY score DESC, total_keystrokes DESC`,
    [fromDate]
  );
  return rows;
};

const getTimeline = async (userId) => {
  const [rows] = await pool.query(
    `SELECT HOUR(created_at) as hour, SUM(keystrokes) as keystrokes, SUM(mouse_clicks) as mouse_clicks, SUM(active_seconds) as active_seconds FROM activity_logs WHERE user_id = ? AND DATE(created_at) = CURDATE() GROUP BY HOUR(created_at) ORDER BY hour`,
    [userId]
  );
  return rows;
};

const getHeatmap = async (userId) => {
  const from = getLocalDate(364); // 365 days back
  const [rows] = await pool.query(
    `SELECT date, total_keystrokes, total_mouse_clicks,
            (total_keystrokes + total_mouse_clicks) as total_actions
     FROM daily_user_stats
     WHERE user_id = ? AND date >= ?
     ORDER BY date ASC`,
    [userId, from]
  );

  // Build a map of date -> total_actions
  const map = {};
  rows.forEach(r => {
    const d = typeof r.date === 'string' ? r.date : r.date.toISOString().slice(0, 10);
    map[d] = Number(r.total_actions) || 0;
  });

  // Find max for normalizing levels
  const maxVal = Math.max(1, ...Object.values(map));

  // Generate full 365-day array
  const result = [];
  for (let i = 364; i >= 0; i--) {
    const dateStr = getLocalDate(i);
    const count   = map[dateStr] || 0;
    // Level 0-4
    let level = 0;
    if (count > 0) {
      const pct = count / maxVal;
      if      (pct <= 0.25) level = 1;
      else if (pct <= 0.50) level = 2;
      else if (pct <= 0.75) level = 3;
      else                  level = 4;
    }
    result.push({ date: dateStr, count, level });
  }
  return result;
};

const getGroupLeaderboard = async (groupId, range) => {
  let fromDate;
  if (range === 'today') fromDate = getLocalDate(0);
  else if (range === 'week') fromDate = getLocalDate(7);
  else if (range === 'month') fromDate = getLocalDate(30);
  else fromDate = getLocalDate(0);

  const [rows] = await pool.query(
    `SELECT u.id as user_id, u.name, u.email, u.avatar, u.status,
      gm.role,
      COALESCE(SUM(d.total_keystrokes), 0) as total_keystrokes,
      COALESCE(SUM(d.total_mouse_clicks), 0) as total_mouse_clicks,
      COALESCE(SUM(d.total_active_seconds), 0) as total_active_seconds,
      COALESCE(SUM(d.total_idle_seconds), 0) as total_idle_seconds,
      COALESCE(SUM(d.score), 0) as score
     FROM group_members gm
     JOIN users u ON gm.user_id = u.id
     LEFT JOIN daily_user_stats d ON d.user_id = u.id AND d.date >= ?
     WHERE gm.group_id = ?
     GROUP BY u.id, u.name, u.email, u.avatar, u.status, gm.role
     ORDER BY score DESC, total_keystrokes DESC`,
    [fromDate, groupId]
  );
  return rows;
};

module.exports = { recordActivity, getTodayStats, getUserStats, getLeaderboard, getGroupLeaderboard, getTimeline, getHeatmap };


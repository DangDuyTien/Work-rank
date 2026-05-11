const pool = require('../config/database');

exports.getUsers = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, email, avatar, status, last_seen_at FROM users');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUser = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, email, avatar, status, last_seen_at FROM users WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

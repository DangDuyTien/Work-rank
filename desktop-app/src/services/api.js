const axios = require('axios');

class ApiService {
  constructor(token) {
    this.token = token;
    this.baseURL = process.env.API_URL || 'http://localhost:5001';
    this.connected = false;
  }

  async ping() {
    this.connected = false;
    throw new Error('ApiService.ping is deprecated. Use /api/activity/session/start and /api/activity/batch.');
  }
}

module.exports = { ApiService };

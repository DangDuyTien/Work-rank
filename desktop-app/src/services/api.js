const axios = require('axios');

class ApiService {
  constructor(token) {
    this.token = token;
    this.baseURL = process.env.API_URL || 'http://localhost:3001';
    this.connected = false;
  }

  async ping(data) {
    try {
      const res = await axios.post(`${this.baseURL}/api/activity/ping`, data, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      this.connected = true;
      return res.data;
    } catch (err) {
      this.connected = false;
      throw err;
    }
  }
}

module.exports = { ApiService };

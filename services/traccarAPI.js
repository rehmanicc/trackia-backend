const axios = require("axios");

const traccarAPI = axios.create({
  baseURL: process.env.TRACCAR_URL,
  auth: {
    username: process.env.TRACCAR_EMAIL,
    password: process.env.TRACCAR_PASSWORD
  }
});

module.exports = traccarAPI;
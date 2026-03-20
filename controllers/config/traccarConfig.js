const axios = require("axios");

const traccarAPI = axios.create({
  baseURL: process.env.TRACCAR_URL,
  withCredentials: true
});

module.exports = traccarAPI;
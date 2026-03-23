const axios = require("axios");

const traccarAPI = axios.create({
  baseURL: process.env.TRACCAR_URL
});

// Add interceptor to attach auth dynamically
traccarAPI.interceptors.request.use((config) => {

  const EMAIL = process.env.TRACCAR_EMAIL;
  const PASSWORD = process.env.TRACCAR_PASSWORD;

  const authHeader =
    "Basic " + Buffer.from(`${EMAIL}:${PASSWORD}`).toString("base64");

  config.headers.Authorization = authHeader;

  return config;
});

module.exports = traccarAPI;
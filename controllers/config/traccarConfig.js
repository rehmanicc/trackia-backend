const axios = require("axios");

const EMAIL = process.env.TRACCAR_EMAIL;
const PASSWORD = process.env.TRACCAR_PASSWORD;

const traccarAPI = axios.create({
  baseURL: process.env.TRACCAR_URL,
  auth: {
    username: EMAIL,
    password: PASSWORD
  },
  headers: {
    Authorization:
      "Basic " + Buffer.from(`${EMAIL}:${PASSWORD}`).toString("base64")
  }
});

module.exports = traccarAPI;
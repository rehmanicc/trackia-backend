const axios = require("axios");

const traccarAPI = axios.create({
  baseURL: process.env.TRACCAR_URL,
  timeout: 10000, // 🔥 prevents hanging requests
  auth: {
    username: process.env.TRACCAR_EMAIL,
    password: process.env.TRACCAR_PASSWORD
  }
});

// ✅ RESPONSE INTERCEPTOR (VERY IMPORTANT)
traccarAPI.interceptors.response.use(
  (response) => {
    // 🔥 Detect wrong response (HTML instead of JSON)
    if (typeof response.data === "string" && response.data.includes("<!DOCTYPE")) {
      console.error("❌ Traccar returned HTML → wrong URL or auth");
      return Promise.reject({
        message: "Invalid Traccar response (HTML)"
      });
    }

    return response;
  },
  (error) => {
    console.error("❌ Traccar Error:", error.message);

    if (error.response) {
      return Promise.reject({
        message: error.response.data || "Traccar API error"
      });
    }

    return Promise.reject({
      message: error.message || "Unknown error"
    });
  }
);

module.exports = traccarAPI;
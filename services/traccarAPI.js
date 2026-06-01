const axios = require("axios");
const { wrapper } = require("axios-cookiejar-support");
const { CookieJar } = require("tough-cookie");

const jar = new CookieJar();
let loginPromise = null;
const client = wrapper(axios.create({
  baseURL: "http://localhost:8082",
  jar,
  withCredentials: true,
}));
let isLoggedIn = false;

const loginTraccar = async () => {
  if (loginPromise) return loginPromise;

  loginPromise = (async () => {
    try {
      const email = process.env.TRACCAR_EMAIL;
      const password = process.env.TRACCAR_PASSWORD;

      const formData = new URLSearchParams();
      formData.append("email", email);
      formData.append("password", password);

      const res = await client.post("/api/session", formData.toString(), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      });

      const cookies = await jar.getCookies("http://localhost:8082");

      if (res.status === 200 && cookies.length > 0) {
        isLoggedIn = true;
        //console.log("✅ Traccar login success");
      } else {
        isLoggedIn = false;
        console.log("❌ Login failed (no cookies)");
      }

    } catch (err) {
      console.error("❌ Login failed:", err.response?.data || err.message);
      isLoggedIn = false;
    } finally {
      loginPromise = null;
    }
  })();

  return loginPromise;
};
const getPositions = async () => {
  try {

    // Ensure login
    if (!isLoggedIn) {
      await loginTraccar();
    }

    const res = await client.get("/api/positions");
    return res.data;

  } catch (err) {

    // Retry on session expiry
    if (err.response?.status === 401) {
      //console.log("⚠️ Session expired. Re-logging...");

      isLoggedIn = false;
      await loginTraccar();

      const retry = await client.get("/api/positions");
      return retry.data;
    }

    console.error("❌ Positions error:", err.response?.data || err.message);
    throw err;
  }
};

const apiGet = async (url, config = {}) => {
  try {
    if (!isLoggedIn) await loginTraccar();

    const res = await client.get(url, config);
    return res.data;

  } catch (err) {
    if (err.response?.status === 401) {
      isLoggedIn = false;
      await loginTraccar();
      const retry = await client.get(url, config);
      return retry.data;
    }
    throw err;
  }
};

const apiPost = async (url, data) => {
  try {
    if (!isLoggedIn) await loginTraccar();

    const res = await client.post(url, data);
    return res.data;

  } catch (err) {
    if (err.response?.status === 401) {
      isLoggedIn = false;
      await loginTraccar();
      const retry = await client.post(url, data);
      return retry.data;
    }
    throw err;
  }
};
const apiPut = async (url, data) => {
  try {
    if (!isLoggedIn) await loginTraccar();

    const res = await client.put(url, data);
    return res.data;

  } catch (err) {

    if (err.response?.status === 401) {

      isLoggedIn = false;
      await loginTraccar();

      const retry = await client.put(url, data);
      return retry.data;
    }

    throw err;
  }
};
const apiDelete = async (url) => {
  try {
    if (!isLoggedIn) await loginTraccar();

    const res = await client.delete(url);
    return res.data;

  } catch (err) {
    if (err.response?.status === 401) {
      isLoggedIn = false;
      await loginTraccar();
      const retry = await client.delete(url);
      return retry.data;
    }
    throw err;
  }
};

module.exports = {
  loginTraccar,
  getPositions,
  apiGet,
  apiPost,
  apiPut,
  apiDelete
};
const axios = require("axios");
const Position = require("../models/Position");
const TRACCAR_URL = process.env.TRACCAR_URL;
const EMAIL = process.env.TRACCAR_EMAIL;
const PASSWORD = process.env.TRACCAR_PASSWORD;

let sessionCookie = "";

// LOGIN FUNCTION
async function loginTraccar() {

  const params = new URLSearchParams();
  params.append("email", EMAIL);
  params.append("password", PASSWORD);

  const response = await axios.post(
    `${TRACCAR_URL}/session`,
    params,
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }, withCredentials: true
    }
  );

  sessionCookie = response.headers["set-cookie"][0].split(";")[0];

  console.log("✅ Logged into Traccar");
}

// GET DEVICES
exports.getDevices = async (req, res) => {

  try {

    if (!sessionCookie) {
      await loginTraccar();
    }

    const response = await axios.get(
      `${TRACCAR_URL}/devices`,
      {
        headers: {
          Cookie: sessionCookie
        }, withCredentials: true
      }
    );

    res.json(response.data);

  } catch (error) {

    console.log("TRACCAR ERROR:");
    console.log(error.message);

    if (error.response) {
      console.log(error.response.data);
    }

    res.status(500).json({
      error: error.message
    });

  }

};

// get positions
exports.getPositions = async (req, res) => {
  console.log("API HIT: getPositions called");
  try {

    if (!sessionCookie) {
      await loginTraccar();
    }

    const response = await axios.get(
      `${TRACCAR_URL}/positions`,
      {
        headers: {
          Cookie: sessionCookie
        }, withCredentials: true
      }
    );

    const positions = response.data;

    // SAVE POSITIONS TO DATABASE
    for (const pos of positions) {

      console.log("Saving:", pos.deviceId, pos.latitude, pos.longitude);

      const saved = await Position.create({
        deviceId: pos.deviceId,
        latitude: pos.latitude,
        longitude: pos.longitude,
        speed: pos.speed,
        deviceTime: pos.deviceTime
      });

      console.log("Saved ID:", saved._id);
    }

    res.json(positions);

  } catch (error) {

    if (error.response && error.response.status === 401) {

      console.log("Session expired. Logging in again...");

      await loginTraccar();

      const retry = await axios.get(
        `${TRACCAR_URL}/positions`,
        {
          headers: {
            Cookie: sessionCookie
          }, withCredentials: true
        }
      );

      return res.json(retry.data);

    }

    console.log("POSITION ERROR:", error.message);

    res.status(500).json({
      error: error.message
    });

  }

};
//add device
exports.addDevice = async (req, res) => {

  try {

    if (!sessionCookie) {
      await loginTraccar();
    }

    const { name, uniqueId } = req.body;

    const response = await axios.post(
      `${TRACCAR_URL}/devices`,
      {
        name: name,
        uniqueId: uniqueId
      },
      {
        headers: {
          Cookie: sessionCookie
        }, withCredentials: true
      }
    );

    res.json(response.data);

  } catch (error) {

    console.log("ADD DEVICE ERROR:", error.message);

    res.status(500).json({
      error: error.message
    });

  }

};
//get routs
exports.getRoute = async (req, res) => {

  try {

    const { deviceId, from, to } = req.query;

    if (!sessionCookie) {
      await loginTraccar();
    }

    const response = await axios.get(
      `${TRACCAR_URL}/reports/route`,
      {
        params: {
          deviceId,
          from,
          to
        },
        headers: {
          Cookie: sessionCookie
        }, withCredentials: true
      }
    );

    res.json(response.data);

  } catch (error) {

    console.log("ROUTE ERROR:", error.message);

    res.status(500).json({
      error: error.message
    });

  }

};
//Get Trips
exports.getTrips = async (req, res) => {

  try {

    const { deviceId, from, to } = req.query

    if (!sessionCookie) {
      await loginTraccar()
    }

    const response = await axios.get(
      `${TRACCAR_URL}/reports/trips`,
      {
        params: {
          deviceId,
          from,
          to
        },
        headers: {
          Cookie: sessionCookie
        }, withCredentials: true
      }
    )

    res.json(response.data)

  } catch (error) {

    console.log("TRIPS ERROR:", error.message)

    res.status(500).json({
      error: error.message
    })

  }

}
const axios = require("axios");
const Position = require("../models/Position");
const TRACCAR_URL = process.env.TRACCAR_URL;
const EMAIL = process.env.TRACCAR_EMAIL;
const PASSWORD = process.env.TRACCAR_PASSWORD;

// GET DEVICES
exports.getDevices = async (req, res) => {
  try {

    const response = await axios.get(
      `${TRACCAR_URL}/devices`,
      {
        auth: {
          username: EMAIL,
          password: PASSWORD
        }
      }
    );

    res.json(response.data);

  } catch (error) {

    console.log("TRACCAR ERROR:", error.message);

    if (error.response) {
      console.log(error.response.data);
    }

    res.status(500).json({
      error: error.message
    });

  }
};

//Get positions API
exports.getPositions = async (req, res) => {
  console.log("API HIT: getPositions called");

  try {

    const response = await axios.get(
      `${TRACCAR_URL}/positions`,
      {
        auth: {
          username: EMAIL,
          password: PASSWORD
        }
      }
    );

    const positions = response.data;

    // SAVE POSITIONS (NO DUPLICATES)
    for (const pos of positions) {

      await Position.updateOne(
        {
          deviceId: pos.deviceId,
          deviceTime: pos.deviceTime
        },
        {
          $set: {
            latitude: pos.latitude,
            longitude: pos.longitude,
            speed: pos.speed
          }
        },
        { upsert: true }
      );

    }

    res.json(positions);

  } catch (error) {

    console.log("POSITION ERROR:", error.message);

    if (error.response) {
      console.log(error.response.data);
    }

    res.status(500).json({
      error: error.message
    });

  }
};
//add device
exports.addDevice = async (req, res) => {
  try {

    const { name, uniqueId } = req.body;

    const response = await axios.post(
      `${TRACCAR_URL}/devices`,
      {
        name: name,
        uniqueId: uniqueId
      },
      {
        auth: {
          username: EMAIL,
          password: PASSWORD
        }
      }
    );

    res.json(response.data);

  } catch (error) {

    console.log("ADD DEVICE ERROR:", error.message);

    if (error.response) {
      console.log(error.response.data);
    }

    res.status(500).json({
      error: error.message
    });

  }
};
//get routs
exports.getRoute = async (req, res) => {
  try {

    const { deviceId, from, to } = req.query;

    const response = await axios.get(
      `${TRACCAR_URL}/reports/route`,
      {
        params: {
          deviceId,
          from,
          to
        },
        auth: {
          username: EMAIL,
          password: PASSWORD
        }
      }
    );

    res.json(response.data);

  } catch (error) {

    console.log("ROUTE ERROR:", error.message);

    if (error.response) {
      console.log(error.response.data);
    }

    res.status(500).json({
      error: error.message
    });

  }
};
//Get Trips
exports.getTrips = async (req, res) => {
  try {

    const { deviceId, from, to } = req.query;

    const response = await axios.get(
      `${TRACCAR_URL}/reports/trips`,
      {
        params: {
          deviceId,
          from,
          to
        },
        auth: {
          username: EMAIL,
          password: PASSWORD
        }
      }
    );

    res.json(response.data);

  } catch (error) {

    console.log("TRIPS ERROR:", error.message);

    if (error.response) {
      console.log(error.response.data);
    }

    res.status(500).json({
      error: error.message
    });

  }
};
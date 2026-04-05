const axios = require("axios");
const Position = require("../models/Position");
const TRACCAR_URL = process.env.TRACCAR_URL;
const EMAIL = process.env.TRACCAR_EMAIL;
const PASSWORD = process.env.TRACCAR_PASSWORD;
const traccarAPI = require("../services/traccarAPI");
const { processPosition } = require("../services/geofenceEngine");

//Get positions API
exports.getPositions = async (req, res) => {
  try {
    const response = await traccarAPI.get("/api/positions");

    const positions = response.data;

    // 🔥 PREPARE BULK DATA
    const docs = positions.map(p => ({
      deviceId: p.deviceId,
      latitude: p.latitude,
      longitude: p.longitude,
      speed: p.speed,
      deviceTime: p.deviceTime
    }));

    // 🔥 INSERT (FAST + SAFE)
    try {
      await Position.insertMany(docs, { ordered: false });
    } catch (err) {
      // ignore duplicates
    }

    const io = require("../socket").getIO();

    // 🔥 FIRST: process geofence + alerts
    for (const p of positions) {
      await processPosition({
        deviceId: p.deviceId,
        latitude: p.latitude,
        longitude: p.longitude,
        speed: p.speed,
        attributes: p.attributes || {},
        deviceTime: p.deviceTime
      }, io);
    }

    // 🔥 THEN: emit positions to frontend
    io.emit("positions", positions);

    console.log("📡 EMITTING POSITIONS:", positions.length);

    res.json(positions);

  } catch (error) {
    console.error("Traccar error:", error.message);
    res.status(500).json({ error: error.message });
  }
};
//get routs
exports.getRoute = async (req, res) => {
  try {

    const { deviceId, from, to } = req.query;

    const response = await traccarAPI.get("/api/reports/route", {
      params: { deviceId, from, to }
    });

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

    const response = await traccarAPI.get("/api/reports/trips", {
      params: { deviceId, from, to }
    });

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
//commands
// SEND COMMAND
exports.sendCommand = async (req, res) => {
  try {
    const { deviceId, type } = req.body;

    // Validate input
    if (!deviceId || !type) {
      return res.status(400).json({
        error: "deviceId and type are required"
      });
    }

    const response = await traccarAPI.post("/api/commands/send", {
      deviceId,
      type
    });

    res.json(response.data);

  } catch (error) {
    console.error("COMMAND ERROR:", error.message);

    if (error.response) {
      console.error("Traccar Response:", error.response.data);
    }

    res.status(500).json({
      error: error.message || "Failed to send command"
    });
  }
};
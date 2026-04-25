const axios = require("axios");
const Position = require("../models/Position");
const TRACCAR_URL = process.env.TRACCAR_URL;
const EMAIL = process.env.TRACCAR_EMAIL;
const PASSWORD = process.env.TRACCAR_PASSWORD;
const Device = require("../models/Device");
const { getPositions, apiGet, apiPost } = require("../services/traccarAPI");
const { processPosition } = require("../services/geofenceEngine");
const { handleAlerts } = require("../services/alert/alertProcessor");

//Get positions API
exports.getPositions = async (req, res) => {
  try {
    const positions = await getPositions();

    const socket = require("../socket");
    const io = socket.getIO();

    // 🔥 PRELOAD DEVICES (OPTIMIZED)
    const deviceIds = positions.map(p => p.deviceId);
    const devices = await Device.find({ traccarId: { $in: deviceIds } });
    const deviceMap = {};
    devices.forEach(d => {
      deviceMap[d.traccarId] = d;
    });

    const activePositions = [];

    // ======================
    // PROCESS POSITIONS
    // ======================
    for (const p of positions) {

      const device = deviceMap[p.deviceId];

      if (!device) continue;

      // 🔥 EXPIRY CHECK
      if (!device.isActive || new Date() > new Date(device.expiryDate)) {
        console.log(`⛔ Device ${device.traccarId} expired — skipped`);
        continue;
      }
      console.log("💾 Saving:", p.deviceId, p.deviceTime);
      // ✅ SAVE ONLY ACTIVE
      const lat = Number(p.latitude);
      const lng = Number(p.longitude);

      // ❌ HARD FILTER BEFORE SAVE
      const isValid =
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 && lat <= 90 &&
        lng >= -180 && lng <= 180 &&
        !(lat === 0 && lng === 0);

      if (!isValid) {
        console.log("❌ SKIPPED INVALID (SAVE):", {
          rawLat: p.latitude,
          rawLng: p.longitude,
          parsedLat: lat,
          parsedLng: lng,
          deviceTime: p.deviceTime
        });
        continue; // 🔥 DO NOT SAVE BAD DATA
      }

      await Position.updateOne(
        {
          deviceId: p.deviceId,
          deviceTime: p.deviceTime
        },
        {
          $setOnInsert: {
            deviceId: p.deviceId,
            latitude: lat,
            longitude: lng,
            speed: Number(p.speed) || 0,
            deviceTime: p.deviceTime
          }
        },
        { upsert: true }
      );

      if (io) {
        await processPosition({
          deviceId: p.deviceId,
          latitude: p.latitude,
          longitude: p.longitude,
          speed: p.speed,
          attributes: p.attributes || {},
          deviceTime: p.deviceTime
        }, io);

        await handleAlerts(p, io);
      }

      activePositions.push({
        ...p,
        engineOn: p.attributes?.ignition === true,
       
        name: device?.name || null,
        registrationNumber: device?.registrationNumber || null,
      });
    }

    if (io) {
      io.emit("positions", activePositions);
    }

    console.log("📡 ACTIVE POSITIONS:", activePositions.length);

    res.json(activePositions);

  } catch (error) {
    console.error("Traccar error:", error.message);
    res.status(500).json({ error: error.message });
  }
};
//get routs
exports.getRoute = async (req, res) => {
  try {

    let { deviceId, from, to } = req.query;

    // 🔥 ADD BUFFER (10 minutes)
    const bufferMs = 10 * 60 * 1000;
    to = new Date(new Date(to).getTime() + bufferMs).toISOString();

    const data = await apiGet("/api/reports/route", {
      params: { deviceId, from, to }
    });

    res.json(data);

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

    const data = await apiGet("/api/reports/trips", {
      params: { deviceId, from, to }
    });

    res.json(data);

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

// SEND COMMAND
exports.sendCommand = async (req, res) => {
  try {
    const { deviceId, type } = req.body;

    if (!deviceId || !type) {
      return res.status(400).json({
        error: "deviceId and type are required"
      });
    }

    const device = await Device.findOne({ traccarId: deviceId });

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    if (
      req.user.role === "admin" &&
      String(device.adminId) !== String(req.user._id)
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    // 🔐 ROLE CHECK
    const isOwnerOrAdmin =
      req.user.role === "owner" || req.user.role === "admin";

    // 🔐 GENERAL COMMAND PERMISSION
    if (!isOwnerOrAdmin && !req.user.permissions?.includes("SEND_COMMAND")) {
      return res.status(403).json({
        error: "No command permission"
      });
    }

    // 🔥 ENGINE CONTROL CHECK
    const ENGINE_COMMANDS = ["engineStop", "engineResume"];

    if (ENGINE_COMMANDS.includes(type)) {

      // ❌ Users need permission
      if (!isOwnerOrAdmin && !req.user.permissions?.includes("ENGINE_CONTROL")) {
        return res.status(403).json({
          error: "No engine control permission"
        });
      }

      // ❌ Block if feature disabled
      if (!device.engineControlEnabled) {
        return res.status(403).json({
          error: "Engine control disabled by admin/owner"
        });
      }

      // ❌ Block user if admin locked engine
      if (
        type === "engineResume" &&
        !isOwnerOrAdmin &&
        device.engineLockedByAdmin
      ) {
        return res.status(403).json({
          error: "Engine locked by admin"
        });
      }

      // 🔒 Admin turns OFF → lock engine
      if (type === "engineStop" && isOwnerOrAdmin) {
        device.engineLockedByAdmin = true;
        device.engineLockedBy = req.user._id;
        await device.save();
      }

      // 🔓 Admin turns ON → unlock engine
      if (type === "engineResume" && isOwnerOrAdmin) {
        device.engineLockedByAdmin = false;
        device.engineLockedBy = null;
        await device.save();
      }
    }

    const data = await apiPost("/api/commands/send", {
      deviceId,
      type
    });

    res.json(data);

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};
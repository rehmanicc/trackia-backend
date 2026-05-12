const Position = require("../models/Position");
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

      const result = await Position.updateOne(
        {
          positionId: p.id
        },
        {
          $setOnInsert: {
            positionId: p.id,
            deviceId: p.deviceId,
            latitude: lat,
            longitude: lng,
            speed: Number(p.speed) || 0,
            course: Number(p.course) || 0,
            deviceTime: p.deviceTime
          }
        },
        { upsert: true }
      );

      const isNew =
        result.upsertedCount > 0;
      if (io && isNew) {
        await processPosition({
          deviceId: p.deviceId,
          latitude: lat,
          longitude: lng,
          speed: Number(p.speed) || 0,
          attributes: p.attributes || {},
          deviceTime: p.deviceTime
        }, io);

        await handleAlerts(p, io);
        activePositions.push({
          ...p,
          engineOn: p.attributes?.ignition === true,

          name: device?.name || null,
          registrationNumber: device?.registrationNumber || null,
        });
      }


    }
    if (io && activePositions.length > 0) {
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
      String(device.adminId) !== String(req.user.id)
    ) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (
      req.user.role === "user" &&
      !device.assignedUsers.some(
        (u) => String(u) === String(req.user.id)
      )
    ) {
      return res.status(403).json({
        error: "Device not assigned to user"
      });
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
        device.engineLockedBy = req.user.id;
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
exports.getHistory = async (req, res) => {

  try {

    const { deviceId, from, to } = req.query;

    if (!deviceId || !from || !to) {

      return res.status(400).json({
        error: "deviceId, from, to required"
      });
    }

    const positions = await Position.find({
      deviceId: Number(deviceId),
      deviceTime: {
        $gte: new Date(from),
        $lte: new Date(to)
      }
    }).sort({ deviceTime: 1 });

    res.json(positions);

  } catch (err) {

    console.log(
      "❌ HISTORY ERROR:",
      err.message
    );

    res.status(500).json({
      error: err.message
    });
  }
};
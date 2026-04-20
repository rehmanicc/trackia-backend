const express = require("express");
const router = express.Router();
const Device = require("../models/Device");
const {
    getPositions,
    getRoute,
    sendCommand,
    getTrips
} = require("../controllers/traccarController");

const authMiddleware = require("../middleware/authMiddleware");

// ======================
// ASSIGN DEVICE TO USER
// ======================
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../config/permissions");


router.post("/assign-device", authMiddleware, async (req, res) => {

    if (req.user.role !== "admin") {
        return res.status(403).json({ error: "Only admin can assign devices" });
    }

    const { deviceId, userId } = req.body;

    if (!deviceId || !userId) {
        return res.status(400).json({ error: "Missing deviceId or userId" });
    }

    try {

        const device = await Device.findById(deviceId);

        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }

        if (String(device.adminId) !== req.user.id) {
            return res.status(403).json({ error: "Not allowed" });
        }

        device.assignedTo = userId;
        await device.save();

        res.json({ success: true, device });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Assignment failed" });
    }
});

// ======================
// ADD DEVICE (ADMIN ONLY)
// ======================

console.log("Traccar routes loaded");
// ======================
// POSITIONS
// ======================
router.get("/positions", authMiddleware, getPositions);

// ======================
// ROUTE HISTORY
// ======================
router.get("/route", authMiddleware, getRoute);

// ======================
// TRIPS
// ======================
router.get("/trips", authMiddleware, getTrips);

// ======================
// COMMAND
// ======================
router.post("/command",
    authMiddleware,
    checkPermission(PERMISSIONS.SEND_COMMAND),
    sendCommand
);
// ======================
// WEBHOOK (REAL-TIME POSITIONS)
// ======================
router.post("/webhook", async (req, res) => {
  try {
    console.log("🔥 WEBHOOK HIT");

    const socket = require("../socket");
    const io = socket.getIO();

    const Position = require("../models/Position");
    const Device = require("../models/Device");

    const { processPosition } = require("../services/geofenceEngine");
    const { handleAlerts } = require("../services/alert/alertProcessor");

    let positions = [];

    if (Array.isArray(req.body)) {
      positions = req.body;
    } else if (req.body.positions) {
      positions = req.body.positions;
    } else {
      positions = [req.body];
    }

    const activePositions = [];

    // 🔥 PRELOAD DEVICES (same as polling)
    const deviceIds = positions.map(p => p.deviceId);
    const devices = await Device.find({ traccarId: { $in: deviceIds } });

    const deviceMap = {};
    devices.forEach(d => {
      deviceMap[d.traccarId] = d;
    });

    for (const p of positions) {

      const device = deviceMap[p.deviceId];
      if (!device) continue;

      // ⛔ skip inactive
      if (!device.isActive || new Date() > new Date(device.expiryDate)) {
        continue;
      }

      console.log("💾 Saving:", p.deviceId, p.deviceTime);

      // ✅ SAVE (same as polling)
      await Position.updateOne(
        {
          deviceId: p.deviceId,
          deviceTime: p.deviceTime
        },
        {
          $setOnInsert: {
            deviceId: p.deviceId,
            latitude: p.latitude,
            longitude: p.longitude,
            speed: p.speed,
            deviceTime: p.deviceTime
          }
        },
        { upsert: true }
      );

      // ✅ GEOFENCE
      if (io) {
        await processPosition({
          deviceId: p.deviceId,
          latitude: p.latitude,
          longitude: p.longitude,
          speed: p.speed,
          attributes: p.attributes || {},
          deviceTime: p.deviceTime
        }, io);

        // ✅ ALERTS
        await handleAlerts(p, io);
      }

      activePositions.push({
        ...p,
        engineOn: p.attributes?.ignition === true
      });
    }

    // ✅ SOCKET EMIT
    if (io && activePositions.length > 0) {
      io.emit("positions", activePositions);
    }

    console.log("⚡ LIVE POSITIONS:", activePositions.length);

    res.sendStatus(200);

  } catch (err) {
    console.error("❌ Webhook error:", err.message);
    res.sendStatus(500);
  }
});
module.exports = router;
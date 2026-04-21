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
const { getPositions: getTraccarPositions } = require("../services/traccarAPI");
const lastPositionCache = new Map();
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
// ======================
// WEBHOOK (REAL-TIME POSITIONS)
// ======================
router.all("/webhook", async (req, res) => {
  try {
    console.log("🔥 WEBHOOK HIT");

    const socket = require("../socket");
    const io = socket.getIO();

    const Position = require("../models/Position");
    const Device = require("../models/Device");

    const { processPosition } = require("../services/geofenceEngine");
    const { handleAlerts } = require("../services/alert/alertProcessor");

    // ✅ IMPORTANT: use SERVICE (not controller)

    let positions = [];

    try {
      positions = await getTraccarPositions();
    } catch (err) {
      console.log("❌ Traccar fetch error:", err.response?.data || err.message);
      return res.sendStatus(200); // prevent retry spam
    }

    if (!positions || positions.length === 0) {
      console.log("⚠️ No positions from Traccar");
      return res.sendStatus(200);
    }

    const activePositions = [];
    const bulkOps = [];
    // 🔥 preload devices
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

      const cacheKey = p.deviceId;

      const last = lastPositionCache.get(cacheKey);

      let shouldSave = true;

      if (last) {
        const moved =
          Math.abs(last.latitude - p.latitude) > 0.00001 ||
          Math.abs(last.longitude - p.longitude) > 0.00001;

        if (!moved) {
          shouldSave = false; // ❗ only skip DB
        }
      }
      lastPositionCache.set(cacheKey, {
        latitude: p.latitude,
        longitude: p.longitude
      });
      if (lastPositionCache.size > 10000) {
        lastPositionCache.clear();
      }
      if (shouldSave) {
        bulkOps.push({
          updateOne: {
            filter: {
              deviceId: p.deviceId,
              deviceTime: p.deviceTime
            },
            update: {
              $setOnInsert: {
                deviceId: p.deviceId,
                latitude: p.latitude,
                longitude: p.longitude,
                speed: p.speed,
                deviceTime: p.deviceTime
              }
            },
            upsert: true
          }
        });
      }

      // ✅ GEOFENCE + ALERTS
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
        engineOn: p.attributes?.ignition === true
      });
    }
    if (bulkOps.length > 0) {
      await Position.bulkWrite(bulkOps);
    }
    // ======================
    // 🔥 EMIT PER USER / COMPANY
    // ======================
    if (io && activePositions.length > 0) {

      const companyGroups = {};

      for (const pos of activePositions) {
        const device = deviceMap[pos.deviceId];
        if (!device) continue;

        const adminId = String(device.adminId);

        if (!companyGroups[adminId]) {
          companyGroups[adminId] = [];
        }

        companyGroups[adminId].push({ pos, device });
      }

      for (const adminId in companyGroups) {
        const items = companyGroups[adminId];

        // 🔹 group per user
        const userGroups = {};
        const companyPositions = [];

        for (const { pos, device } of items) {

          const users = new Set(
            [
              ...(device.assignedUsers || []),
              device.assignedTo
            ]
              .filter(Boolean)
              .map(id => id.toString())
          );

          if (users.size > 0) {
            users.forEach(userId => {
              if (!userGroups[userId]) userGroups[userId] = [];
              userGroups[userId].push(pos);
            });
          } else {
            companyPositions.push(pos);
          }
        }

        // 🔹 emit to users
        for (const userId in userGroups) {
          io.to(`user_${userId}`).emit("positions", userGroups[userId]);
        }

        // 🔹 fallback emit to company
        if (companyPositions.length > 0) {
          io.to(`company_${adminId}`).emit("positions", companyPositions);
        }
      }
    }
    console.log("📡 DEBUG EMIT (GLOBAL):", activePositions.length);

    // TEMP TEST: broadcast to ALL clients
    io.emit("positions", activePositions);
    console.log("⚡ LIVE POSITIONS:", activePositions.length);

    res.sendStatus(200);

  } catch (err) {
    console.error("❌ Webhook error:", err.message);
    res.sendStatus(500);
  }
});
module.exports = router;
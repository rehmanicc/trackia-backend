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



console.log("Traccar routes loaded");

router.get("/positions", authMiddleware, getPositions);


router.get("/route", authMiddleware, getRoute);

router.get("/trips", authMiddleware, getTrips);


router.post("/command",
  authMiddleware,
  checkPermission(PERMISSIONS.SEND_COMMAND),
  sendCommand
);

router.all("/webhook", async (req, res) => {

  // ✅ 1. RESPOND IMMEDIATELY (VERY IMPORTANT)
  res.sendStatus(200);

  // ✅ 2. RUN HEAVY WORK IN BACKGROUND
  setImmediate(async () => {
    try {
      console.log("🔥 WEBHOOK HIT");

      const socket = require("../socket");
      const io = socket.getIO();

      const Position = require("../models/Position");
      const Device = require("../models/Device");

      const { processPosition } = require("../services/geofenceEngine");
      const { handleAlerts } = require("../services/alert/alertProcessor");

      let positions = [];

      try {
        positions = await getTraccarPositions();
      } catch (err) {
        console.log("❌ Traccar fetch error:", err.message);
        return;
      }

      if (!positions || positions.length === 0) {
        console.log("⚠️ No positions from Traccar");
        return;
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

        if (!device.isActive || new Date() > new Date(device.expiryDate)) {
          continue;
        }

        const cacheKey = p.deviceId;
        const last = lastPositionCache.get(cacheKey);

        let shouldSave = true;

        if (last) {
          const moved =
            Math.abs(last.latitude - p.latitude) > 0.00001 ||
            Math.abs(last.longitude - p.longitude) > 0.00001;

          if (!moved) shouldSave = false;
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

        // ✅ Geofence + Alerts
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
          id: p.id,
          deviceId: p.deviceId,
          latitude: p.latitude,
          longitude: p.longitude,
          speed: p.speed,
          course: p.course,
          deviceTime: p.deviceTime,
          engineOn: p.attributes?.ignition === true
        });
      }

      if (bulkOps.length > 0) {
        await Position.bulkWrite(bulkOps);
      }

      // ======================
      // 🔥 EMIT PER USER / COMPANY (CLEAN DATA)
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

          // ✅ Emit to users
          for (const userId in userGroups) {
            try {
              io.to(`user_${userId}`).emit("positions", userGroups[userId]);
            } catch (err) {
              console.error("❌ Emit error (user):", err);
            }
          }

          // ✅ Emit to company
          if (companyPositions.length > 0) {
            try {
              io.to(`company_${adminId}`).emit("positions", companyPositions);
            } catch (err) {
              console.error("❌ Emit error (company):", err);
            }
          }
        }
      }

      console.log("⚡ LIVE POSITIONS:", activePositions.length);

    } catch (err) {
      console.error("❌ Async processing error:", err);
    }
  });
});
module.exports = router;
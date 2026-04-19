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
    console.log("📥 WEBHOOK HIT");
    console.log("📦 DATA:", req.body);

    const Position = require("../models/Position");

    let positions = [];

    // ✅ HANDLE ALL FORMATS FROM TRACCAR
    if (Array.isArray(req.body)) {
      positions = req.body;
    } else if (req.body.positions) {
      positions = req.body.positions;
    } else {
      positions = [req.body];
    }

    for (const pos of positions) {

  // ✅ Handle normal position
  if (pos.deviceId && pos.deviceTime) {

    await Position.updateOne(
      {
        deviceId: pos.deviceId,
        deviceTime: pos.deviceTime
      },
      {
        $setOnInsert: {
          deviceId: pos.deviceId,
          latitude: pos.latitude,
          longitude: pos.longitude,
          speed: pos.speed,
          deviceTime: pos.deviceTime
        }
      },
      { upsert: true }
    );

    console.log("💾 Saved position:", pos.deviceId);

  }

  // 🔥 Handle event (optional)
  else if (pos.event) {
    console.log("⚡ Event received:", pos.event.type);
  }

  else {
    console.log("❌ Unknown data format");
  }
}

    res.sendStatus(200);

  } catch (err) {
    console.error("❌ Webhook error:", err.message);
    res.sendStatus(500);
  }
});
module.exports = router;
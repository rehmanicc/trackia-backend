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

  const { deviceId, userId } = req.body;

  // 🔐 1. PERMISSION CHECK
  if (
    req.user.role !== "owner" &&
    !req.user.permissions?.includes("ASSIGN_DEVICE")
  ) {
    return res.status(403).json({ error: "No assign permission" });
  }

  // ✅ VALIDATION
  if (!deviceId || !userId) {
    return res.status(400).json({ error: "Missing deviceId or userId" });
  }

  try {
    const mongoose = require("mongoose");
    const User = require("../models/User");

    // ✅ Validate IDs
    if (!mongoose.Types.ObjectId.isValid(deviceId)) {
      return res.status(400).json({ error: "Invalid deviceId" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid userId" });
    }

    const device = await Device.findById(deviceId);

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    // 🔒 2. OWNERSHIP CHECK (FIXED)
    if (
      req.user.role !== "owner" &&
      String(device.adminId) !== String(req.user.id)
    ) {
      return res.status(403).json({ error: "Not allowed for this device" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // 🔒 Ensure same admin/company
    if (String(user.adminId) !== String(device.adminId)) {
      return res.status(400).json({
        error: "User and device belong to different admins"
      });
    }

    // 🔥 3. USE CORRECT FIELD (assignedUsers[])
    if (!device.assignedUsers.includes(userId)) {
      device.assignedUsers.push(userId);
    }

    await device.save();

    res.json({
      success: true,
      assignedUsers: device.assignedUsers
    });

  } catch (err) {
    console.error("❌ ASSIGN DEVICE ERROR:", err);
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

const { addToQueue } = require("../services/positionQueue");

/* router.post("/webhook", (req, res) => {

  // ✅ 1. Respond immediately
  res.sendStatus(200);

  // ✅ 2. Push to queue (NO processing here)
  setImmediate(() => {
    try {

      if (!req.body) return;


      console.warn("⚠️ Non-JSON webhook ignored");

      console.log("RAW BODY:", JSON.stringify(req.body));
      const raw = req.body;

      let positions = [];

      // Case 1: array
      if (Array.isArray(raw)) {
        positions = raw;
      }
      // Case 2: wrapped object
      else if (raw.positions) {
        positions = raw.positions;
      }
      // Case 3: single object
      else if (raw.deviceId) {
        positions = [raw];
      }

      // 🔥 Normalize fields
      positions = positions.map(p => ({
        deviceId: p.deviceId,
        latitude: p.latitude || p.lat,
        longitude: p.longitude || p.lon,
        deviceTime: p.deviceTime || p.fixTime,
        speed: p.speed,
        course: p.course,
        attributes: p.attributes || {}
      }));

      // 🔥 Filter valid positions
      positions = positions.filter(p =>
        p.deviceId && p.latitude && p.longitude && p.deviceTime
      );

      if (positions.length === 0) {
        console.log("⚠️ No valid positions after parsing");
        return;
      }

      // 🔥 Avoid log spam
      if (Math.random() < 0.01) {
        console.log("📥 Webhook active");
      }

      // 🔥 Large batch warning
      if (positions.length > 500) {
        console.warn("⚠️ Large batch:", positions.length);
      }

      addToQueue(positions);

    } catch (err) {
      console.error("❌ Webhook queue error:", err);
    }
  });

}); */
module.exports = router;
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
const controller = require("../controllers/traccarController");

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

router.get(
  "/history",
  authMiddleware,
  controller.getHistory
);

const { addToQueue } = require("../services/positionQueue");

router.get(
  "/positions/latest",
  authMiddleware,
  async (req, res) => {

    try {

      const Position =
        require("../models/Position");

      const user = req.user;

      let devices = [];

      // OWNER
      if (user.role === "owner") {

        devices = await Device.find();

      }

      // ADMIN
      else if (user.role === "admin") {

        devices = await Device.find({
          adminId: user.id
        });

      }

      // USER
      else {

        devices = await Device.find({
          assignedUsers: user.id
        });
      }

      const deviceIds =
        devices.map(d => d.traccarId);

      const positions =
        await Position.aggregate([

          {
            $match: {
              deviceId: {
                $in: deviceIds
              }
            }
          },

          {
            $sort: {
              deviceTime: -1
            }
          },

          {
            $group: {
              _id: "$deviceId",
              latest: {
                $first: "$$ROOT"
              }
            }
          }

        ]);

      const formatted =
        positions.map((p) => {

          const pos = p.latest;

          const device =
            devices.find(
              d =>
                d.traccarId === pos.deviceId
            );

          return {

            deviceId: pos.deviceId,

            latitude: pos.latitude,

            longitude: pos.longitude,

            speed: pos.speed,

            deviceTime: pos.deviceTime,

            name:
              device?.name || "",

            registrationNumber:
              device?.registrationNumber || ""

          };
        });

      res.json(formatted);

    } catch (err) {

      console.error(
        "❌ Latest positions error:",
        err.message
      );

      res.status(500).json({
        error:
          "Failed to fetch positions"
      });
    }
  }
);
module.exports = router;
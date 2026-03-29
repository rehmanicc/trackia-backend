const express = require("express");
const router = express.Router();
const Geofence = require("../models/Geofence");
const authMiddleware = require("../middleware/authMiddleware");

// ======================
// GET GEOFENCES (PER USER + DEVICE)
// ======================
router.get("/", authMiddleware, async (req, res) => {

  const deviceId = req.query.deviceId;

  const geofences = await Geofence.find({
    userId: req.user.id,
    deviceId
  });

  res.json(geofences);
});

// ======================
// CREATE GEOFENCE
// ======================
router.post("/", authMiddleware, async (req, res) => {

  const userId = req.user.id;
  const deviceId = req.body.deviceId;

  if (!deviceId) {
    return res.status(400).json({
      error: "deviceId is required"
    });
  }

  // 🔥 ROLE-BASED LIMIT
  let limit = 3;

  if (req.user.role === "admin") limit = 50;
  if (req.user.role === "owner") limit = 1000;

  // 🔥 COUNT PER DEVICE
  const count = await Geofence.countDocuments({
    userId,
    deviceId
  });

  if (count >= limit) {
    return res.status(400).json({
      error: `Maximum ${limit} geofences allowed for this vehicle`
    });
  }

  const geofence = new Geofence({
    ...req.body,
    userId,
    deviceId
  });

  await geofence.save();

  res.json({ success: true, geofence });
});

// ======================
// DELETE GEOFENCE
// ======================
router.delete("/:id", authMiddleware, async (req, res) => {

  await Geofence.deleteOne({
    _id: req.params.id,
    userId: req.user.id
  });

  res.json({ success: true });
});

module.exports = router;
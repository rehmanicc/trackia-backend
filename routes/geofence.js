const express = require("express");
const router = express.Router();
const Geofence = require("../models/Geofence");
const authMiddleware = require("../middleware/authMiddleware");

// ======================
// GET GEOFENCES (PER USER + DEVICE)
// ======================
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { deviceId } = req.query;

    const query = {
      userId: req.user.id
    };

    // ✅ FIX: handle null safely
    if (deviceId && deviceId !== "null") {
      query.deviceId = Number(deviceId);
    }

    const geofences = await Geofence.find(query);

    res.json(geofences);

  } catch (err) {
    console.error("❌ Geofence fetch error:", err);
    res.status(500).json({ error: "Failed to fetch geofences" });
  }
});

// ======================
// UPDATE GEOFENCE NAME
// ======================
router.put("/:id", authMiddleware, async (req, res) => {

  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }

  await Geofence.updateOne(
    { _id: req.params.id, userId: req.user.id },
    { $set: { name } }
  );

  res.json({ success: true });
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
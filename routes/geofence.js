const express = require("express");
const router = express.Router();
const Geofence = require("../models/Geofence");
const authMiddleware = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../config/permissions");
// ======================
// GET GEOFENCES (PER USER + DEVICE)
// ======================
router.get("/",
  authMiddleware,
  checkPermission(PERMISSIONS.GEOFENCE_VIEW),
  async (req, res) => {
    try {
      const { deviceId } = req.query;

      const query = {
        userId: req.user.id
      };

      // ✅ FIX: handle null safely
      if (deviceId && deviceId !== "null") {
        query.deviceId = String(deviceId);
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
router.put("/:id",
  authMiddleware,
  checkPermission(PERMISSIONS.GEOFENCE_EDIT),
  async (req, res) => {

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

  const Device = require("../models/Device");

router.put(
  "/:id/set-call",
  authMiddleware,
  checkPermission(PERMISSIONS.GEOFENCE_EDIT),
  async (req, res) => {
    try {
      const geofenceId = req.params.id;

      // 🔍 Get geofence
      const geofence = await Geofence.findById(geofenceId);
      if (!geofence) {
        return res.status(404).json({ error: "Geofence not found" });
      }

      // 🔍 Get device
      const device = await Device.findOne({
        traccarId: geofence.deviceId
      });

      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }

      // 🔒 Only assigned call user can set
      if (device.callUserId?.toString() !== req.user.id) {
        return res.status(403).json({ error: "Not allowed" });
      }

      // 🔒 Ensure geofence belongs to this user
      if (geofence.userId.toString() !== req.user.id) {
        return res.status(403).json({ error: "Invalid geofence" });
      }

      // ✅ Set call geofence (ONLY ONE)
      device.callGeofenceId = geofenceId;

      await device.save();

      res.json({ success: true });

    } catch (err) {
      console.error("❌ Set call geofence error:", err);
      res.status(500).json({ error: "Failed to set call geofence" });
    }
  }
);
// ======================
// CREATE GEOFENCE
// ======================
router.post("/",
  authMiddleware,
  checkPermission(PERMISSIONS.GEOFENCE_CREATE),
  async (req, res) => {
    const userId = req.user.id;
    const deviceId = req.body.deviceId;

    if (!deviceId) {
      return res.status(400).json({
        error: "deviceId is required"
      });
    }

    // 🔥 ROLE-BASED LIMIT
    const limit = 2;

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
const Device = require("../models/Device");

router.delete("/:id",
  authMiddleware,
  checkPermission(PERMISSIONS.GEOFENCE_DELETE),
  async (req, res) => {

    const geofence = await Geofence.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!geofence) {
      return res.status(404).json({ error: "Geofence not found" });
    }

    // 🔥 check device BEFORE delete
    const device = await Device.findOne({
      traccarId: geofence.deviceId
    });

    if (
      device?.callGeofenceId?.toString() === req.params.id
    ) {
      device.callGeofenceId = null;
      await device.save();
    }

    await Geofence.deleteOne({ _id: req.params.id });

    res.json({ success: true });
  }
);

module.exports = router;
const express = require("express");
const router = express.Router();

const Geofence = require("../models/Geofence");
const Device = require("../models/Device");

const authMiddleware = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../config/permissions");

// ======================
// GET GEOFENCES (PER DEVICE WITH ACCESS CONTROL)
// ======================
router.get(
  "/",
  authMiddleware,
  checkPermission(PERMISSIONS.MANAGE_GEOFENCES),
  async (req, res) => {
    try {
      const { deviceId } = req.query;

      if (!deviceId || deviceId === "null") {
        return res.status(400).json({ error: "deviceId required" });
      }

      // 🔍 Get device
      const device = await Device.findOne({
        traccarId: String(deviceId),
      });

      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }

      // 🔒 Access check
      const isAuthority =
        req.user.role === "owner" ||
        req.user.role === "admin";

      const isAssigned = device.assignedUsers?.some(
        (u) => u.toString() === req.user.id
      );

      if (!isAuthority && !isAssigned) {
        return res.status(403).json({ error: "Permission denied" });
      }

      // ✅ Fetch ALL geofences for this device
      const geofences = await Geofence.find({
        deviceId: String(deviceId),
      });

      res.json({
        geofences,
        ownerUserId: device.ownerUserId,
        callGeofenceId: device.callGeofenceId,
      });
    } catch (err) {
      console.error("❌ Geofence fetch error:", err);
      res.status(500).json({ error: "Failed to fetch geofences" });
    }
  }
);

// ======================
// CREATE GEOFENCE
// ======================
router.post(
  "/",
  authMiddleware,
  checkPermission(PERMISSIONS.MANAGE_GEOFENCES),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const deviceId = req.body.deviceId;

      if (!deviceId) {
        return res.status(400).json({
          error: "deviceId is required",
        });
      }

      // 🔍 Check device
      const device = await Device.findOne({
        traccarId: String(deviceId),
      });

      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }

      // 🔒 Access check
      const isAuthority =
        req.user.role === "owner" ||
        req.user.role === "admin";

      const isAssigned = device.assignedUsers?.some(
        (u) => u.toString() === userId
      );

      if (!isAuthority && !isAssigned) {
        return res.status(403).json({
          error: "Permission denied"
        });
      }

      // 🔥 LIMIT: 2 per user per device
      const limit = 2;

      const count = await Geofence.countDocuments({
        userId,
        deviceId,
      });

      if (count >= limit) {
        return res.status(400).json({
          error: `Maximum ${limit} geofences allowed for this vehicle`,
        });
      }

      const geofence = new Geofence({
        ...req.body,
        userId,
        deviceId,
        createdByRole:
          req.user.role === "admin"
            ? "admin"
            : "user"
      });

      await geofence.save();

      res.json({ success: true, geofence });
    } catch (err) {
      console.error("❌ Create geofence error:", err);
      res.status(500).json({ error: "Failed to create geofence" });
    }
  }
);

// ======================
// UPDATE GEOFENCE
// ======================

router.put(
  "/:id",
  authMiddleware,
  checkPermission(PERMISSIONS.MANAGE_GEOFENCES),
  async (req, res) => {
    try {

      const geofence = await Geofence.findOne({
        _id: req.params.id,
        userId: req.user.id,
      });

      if (!geofence) {
        return res.status(404).json({
          error: "Geofence not found",
        });
      }

      // ======================
      // UPDATE DATA
      // ======================

      const updateData = {
        name: req.body.name,
        type: req.body.type,
        geometry: req.body.geometry,
      };

      const updatedGeofence =
        await Geofence.findByIdAndUpdate(
          req.params.id,
          {
            $set: updateData,
          },
          {
            new: true,
          }
        );

      res.json({
        success: true,
        geofence: updatedGeofence,
      });

    } catch (err) {

      console.error(
        "❌ Update geofence error:",
        err
      );

      res.status(500).json({
        error: "Failed to update geofence",
      });
    }
  }
);

// ======================
// SET CALL GEOFENCE
// ======================
router.put(
  "/:id/set-call",
  authMiddleware,
  checkPermission(
    PERMISSIONS.MANAGE_GEOFENCES
  ),
  async (req, res) => {
    try {
      const geofenceId = req.params.id;

      const geofence = await Geofence.findById(geofenceId);
      if (!geofence) {
        return res.status(404).json({ error: "Geofence not found" });
      }

      const device = await Device.findOne({
        traccarId: geofence.deviceId,
      });

      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }

      // 🔒 Only assigned call user can set
      const ownerPermission =
        device.devicePermissions.find(
          p =>
            String(p.userId) ===
            String(device.ownerUserId)
        );

      const ownerCanManageCall =
        device.ownerUserId &&
        ownerPermission?.editCallNumber;

      // Owner controls call geofence
      if (ownerCanManageCall) {

        if (
          String(device.ownerUserId) !==
          String(req.user.id)
        ) {
          return res.status(403).json({
            error:
              "Only owner can set call geofence"
          });
        }

      }
      // Admin fallback
      else {

        const isAdmin =
          req.user.role === "admin" ||
          req.user.role === "owner";

        if (!isAdmin) {
          return res.status(403).json({
            error:
              "Only admin can set call geofence"
          });
        }
      }

      // Owner may only select his own geofence
      if (
        ownerCanManageCall &&
        geofence.userId.toString() !==
        req.user.id
      ) {
        return res.status(403).json({
          error: "Invalid geofence"
        });
      }
      if (!ownerCanManageCall) {

        if (
          geofence.createdByRole !==
          "admin"
        ) {
          return res.status(403).json({
            error:
              "Only admin geofences can be selected"
          });
        }

      }
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
// DELETE GEOFENCE
// ======================
router.delete(
  "/:id",
  authMiddleware,
  checkPermission(PERMISSIONS.MANAGE_GEOFENCES),
  async (req, res) => {
    try {
      const geofence = await Geofence.findOne({
        _id: req.params.id,
        userId: req.user.id,
      });

      if (!geofence) {
        return res.status(404).json({ error: "Geofence not found" });
      }

      const device = await Device.findOne({
        traccarId: geofence.deviceId,
      });

      if (
        device?.callGeofenceId?.toString() === req.params.id
      ) {
        device.callGeofenceId = null;
        await device.save();
      }

      await Geofence.deleteOne({ _id: req.params.id });

      res.json({ success: true });
    } catch (err) {
      console.error("❌ Delete geofence error:", err);
      res.status(500).json({ error: "Failed to delete geofence" });
    }
  }
);

module.exports = router;
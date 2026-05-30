const express = require("express");
const router = express.Router();

const ctrl = require("../controllers/deviceController");
const auth = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../config/permissions");

const Device = require("../models/Device");
const { logAudit } = require("../services/auditService");

router.get("/", auth, ctrl.getDevices);

router.post(
  "/:id/assign",
  auth,
  checkPermission(PERMISSIONS.ASSIGN_DEVICE),
  ctrl.assignDevice
);

router.post(
  "/:id/unassign",
  auth,
  checkPermission(PERMISSIONS.ASSIGN_DEVICE),
  ctrl.unassignDevice
);

router.post(
  "/",
  auth,
  checkPermission(PERMISSIONS.CREATE_DEVICE),
  ctrl.createDevice
);

router.put(
  "/:id",
  auth,
  checkPermission(PERMISSIONS.EDIT_DEVICE),
  ctrl.updateDevice
);

router.delete(
  "/:id",
  auth,
  checkPermission(PERMISSIONS.DELETE_DEVICE),
  ctrl.deleteDevice
);

router.put(
  "/:id/speed",
  auth,
  checkPermission(PERMISSIONS.EDIT_SPEED),
  async (req, res) => {
    try {
      const speed = Number(req.body.speedLimit);

      if (isNaN(speed) || speed < 20 || speed > 200) {
        return res.status(400).json({
          error: "Invalid speed limit"
        });
      }

      const device = await Device.findByIdAndUpdate(
        req.params.id,
        { speedLimit: speed },
        { new: true }
      );

      if (!device) {
        return res.status(404).json({
          error: "Device not found"
        });
      }

      await logAudit({
        userId: req.user.id,
        action: "UPDATE_SPEED_LIMIT",
        entity: "Device",
        entityId: device._id,
        metadata: {
          speedLimit: speed
        }
      });

      res.json(device);

    } catch (err) {
      res.status(500).json({
        error: "Failed to update speed limit"
      });
    }
  }
);

router.put(
  "/:id/permissions",
  auth,
  ctrl.updateDevicePermissions
);

module.exports = router;
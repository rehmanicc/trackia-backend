const router = require("express").Router();
const ctrl = require("../controllers/deviceController");
const auth = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../config/permissions");
const Device = require("../models/Device");
const User = require("../models/User");


router.get("/",
  auth,
  checkPermission(PERMISSIONS.VIEW_DEVICE),
  ctrl.getDevices
);

router.post("/:id/assign",
  auth,
  checkPermission(PERMISSIONS.EDIT_DEVICE),
  ctrl.assignDevice
);

router.post("/:id/unassign",
  auth,
  checkPermission(PERMISSIONS.EDIT_DEVICE),
  ctrl.unassignDevice
);
router.post("/",
  auth,
  checkPermission(PERMISSIONS.EDIT_DEVICE),
  ctrl.createDevice
);
router.delete("/:id",
  auth,
  checkPermission(PERMISSIONS.EDIT_DEVICE),
  ctrl.deleteDevice
);
router.put("/:id/speed",
  auth,
  checkPermission(PERMISSIONS.EDIT_SPEED),
  async (req, res) => {
    try {
      const { speedLimit } = req.body;

      const device = await Device.findByIdAndUpdate(
        req.params.id,
        { speedLimit },
        { new: true }
      );

      res.json(device);
    } catch (err) {
      res.status(500).json({ error: "Failed to update speed limit" });
    }
  });
router.post(
  "/renew/:id",
  auth,
  checkPermission(PERMISSIONS.RENEW_DEVICE),
  async (req, res) => {
    try {

      const device = await Device.findById(req.params.id);

      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }

      const newExpiry = new Date(device.expiryDate || new Date());
      newExpiry.setFullYear(newExpiry.getFullYear() + 1);

      device.expiryDate = newExpiry;
      device.isActive = true;

      await device.save();

      res.json({
        message: "Device renewed successfully",
        expiryDate: newExpiry
      });

    } catch (err) {
      console.error("Renew error:", err);
      res.status(500).json({ error: "Renewal failed" });
    }
  }
);
router.post(
  "/:id/toggle-engine-access",
  auth,
  checkPermission(PERMISSIONS.EDIT_DEVICE),
  ctrl.toggleEngineAccess
);
router.put("/transfer/:deviceId",
  auth,
  async (req, res) => {
    try {

      // 🔐 Only owner allowed
      if (req.user.role !== "owner") {
        return res.status(403).json({ error: "Only owner can transfer devices" });
      }

      const { newAdminId } = req.body;
      const mongoose = require("mongoose");

      if (!mongoose.Types.ObjectId.isValid(newAdminId)) {
        return res.status(400).json({ error: "Invalid adminId format" });
      }
      if (!newAdminId) {
        return res.status(400).json({ error: "newAdminId required" });
      }

      const device = await Device.findById(req.params.deviceId);

      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }
      const admin = await User.findOne({
        _id: newAdminId,
        role: "admin"
      });

      if (!admin) {
        return res.status(400).json({ error: "Invalid adminId" });
      }
      if (String(device.adminId) === String(newAdminId)) {
        return res.status(400).json({ error: "Device already belongs to this admin" });
      }

      device.assignedTo = null;

      // 🔥 STEP 2: Change admin
      device.adminId = newAdminId;

      await device.save();

      res.json({ message: "Device transferred successfully" });

    } catch (err) {
      console.error("TRANSFER DEVICE ERROR:", err);
      res.status(500).json({ error: err.message });
    }
  }
);
module.exports = router;
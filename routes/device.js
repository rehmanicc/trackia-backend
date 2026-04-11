const router = require("express").Router();
const ctrl = require("../controllers/deviceController");
const auth = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../config/permissions");
const Device = require("../models/Device");

router.get("/", auth, ctrl.getDevices);
router.post("/:id/assign", auth, ctrl.assignDevice);
router.post("/:id/unassign", auth, ctrl.unassignDevice);
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
router.post("/renew/:id", authMiddleware, async (req, res) => {
  try {
    const user = req.user;

    if (user.role !== "admin") {
      return res.status(403).json({ error: "Only admin can renew devices" });
    }

    const device = await Device.findById(req.params.id);

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    // 🔥 ADD 1 YEAR
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
});
module.exports = router;
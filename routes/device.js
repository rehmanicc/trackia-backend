const express = require("express");
const router = express.Router();

const ctrl = require("../controllers/deviceController");
const auth = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../config/permissions");

// ============================================
// DEVICE LIST
// ============================================

router.get("/", auth, ctrl.getDevices);

// ============================================
// CREATE DEVICE
// ============================================

router.post(
  "/",
  auth,
  checkPermission(PERMISSIONS.MANAGE_DEVICES),
  ctrl.createDevice
);

// ============================================
// UPDATE DEVICE
// ============================================

router.put(
  "/:id",
  auth,
  ctrl.updateDevice
);

// ============================================
// DELETE DEVICE
// ============================================

router.delete(
  "/:id",
  auth,
  checkPermission(PERMISSIONS.MANAGE_DEVICES),
  ctrl.deleteDevice
);

// ============================================
// ASSIGN DEVICE
// ============================================

router.post(
  "/:id/assign",
  auth,
  checkPermission(PERMISSIONS.MANAGE_DEVICES),
  ctrl.assignDevice
);

// ============================================
// UNASSIGN DEVICE
// ============================================

router.post(
  "/:id/unassign",
  auth,
  checkPermission(PERMISSIONS.MANAGE_DEVICES),
  ctrl.unassignDevice
);

// ============================================
// DEVICE PERMISSIONS
// ============================================

router.put(
  "/:id/permissions",
  auth,
  checkPermission(PERMISSIONS.MANAGE_DEVICES),
  ctrl.updateDevicePermissions
);

module.exports = router;
const express = require("express");
const router = express.Router();
const controller = require("../controllers/analyticsController");

const auth = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../config/permissions");

router.get("/report",
  auth,
  checkPermission(PERMISSIONS.VIEW_DEVICE),
  controller.getReport
);

router.get("/top-geofences",
  auth,
  checkPermission(PERMISSIONS.VIEW_DEVICE),
  controller.getTopGeofences
);

router.get("/device-summary",
  auth,
  checkPermission(PERMISSIONS.VIEW_DEVICE),
  controller.getDeviceSummary
);

router.get("/trip/:deviceId",
  auth,
  checkPermission(PERMISSIONS.VIEW_DEVICE),
  controller.getTripAnalytics
);

router.get("/daily",
  auth,
  checkPermission(PERMISSIONS.VIEW_DEVICE),
  controller.getDailyReport
);

module.exports = router;
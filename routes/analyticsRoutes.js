const express = require("express");

const router = express.Router();

const controller =
  require("../controllers/analyticsController");

const auth =
  require("../middleware/authMiddleware");

// ============================================
// ANALYTICS REPORT
// ============================================

router.get(
  "/report",
  auth,
  controller.getReport
);

// ============================================
// TOP GEOFENCES
// ============================================

router.get(
  "/top-geofences",
  auth,
  controller.getTopGeofences
);

// ============================================
// DEVICE SUMMARY
// ============================================

router.get(
  "/device-summary",
  auth,
  controller.getDeviceSummary
);

// ============================================
// TRIP ANALYTICS
// ============================================

router.get(
  "/trip/:deviceId",
  auth,
  controller.getTripAnalytics
);

// ============================================
// DAILY REPORT
// ============================================

router.get(
  "/daily",
  auth,
  controller.getDailyReport
);

module.exports = router;
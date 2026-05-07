const express = require("express");

const router = express.Router();

const auth = require("../middleware/authMiddleware");

const checkPermission = require("../middleware/checkPermission");

const PERMISSIONS = require("../config/permissions");

const dashboardController = require("../controllers/dashboardController");

router.get(
  "/stats",
  auth,
  checkPermission(PERMISSIONS.VIEW_DASHBOARD),
  dashboardController.getDashboardStats
);

router.get(
  "/alerts/critical",
  auth,
  checkPermission(PERMISSIONS.VIEW_DASHBOARD),
  dashboardController.getCriticalAlerts
);

module.exports = router;
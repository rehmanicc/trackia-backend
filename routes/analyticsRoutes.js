// routes/analyticsRoutes.js

const express = require("express");
const router = express.Router();
const controller = require("../controllers/analyticsController");

router.get("/report", controller.getReport);
router.get("/top-geofences", controller.getTopGeofences);
router.get("/device-summary", controller.getDeviceSummary);
router.get("/daily", controller.getDailyReport);
module.exports = router;
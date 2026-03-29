// routes/analyticsRoutes.js

const express = require("express");
const router = express.Router();
const controller = require("../controllers/analyticsController");

router.get("/report", controller.getReport);
module.exports = router;
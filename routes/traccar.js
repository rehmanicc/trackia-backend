const { getDevices, getPositions, addDevice, getRoute, sendCommand } = require("../controllers/traccarController");
const Position = require("../models/Position")
const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { getTrips } = require("../controllers/traccarController")

router.get("/devices", getDevices);

router.post("/devices", addDevice);

router.get("/positions", getPositions);

router.get("/route", getRoute);

router.get("/trips", getTrips);

router.post("/command", authMiddleware, sendCommand);
module.exports = router;
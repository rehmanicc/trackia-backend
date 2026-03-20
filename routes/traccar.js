const { getDevices, getPositions, addDevice, getRoute } = require("../controllers/traccarController");
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
module.exports = router;
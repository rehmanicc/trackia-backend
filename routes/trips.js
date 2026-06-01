const express = require("express");
const router = express.Router();

const Trip = require("../models/Trip");
const Device = require("../models/Device");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/", authMiddleware, async (req, res) => {
  try {

    // 🔥 MOVE await INSIDE async function
    let devices = [];

    if (req.user.role === "owner") {

      devices = await Device.find();

    }
    else if (req.user.role === "admin") {

      devices = await Device.find({
        adminId: req.user.id
      });

    }
    else {

      devices = await Device.find({
        assignedUsers: req.user.id
      });

    }

    const deviceIds = devices.map(d => d.traccarId);

    const trips = await Trip.find({
      deviceId: { $in: deviceIds }
    });

    res.json(trips);

  } catch (err) {
    console.error("❌ Trips error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
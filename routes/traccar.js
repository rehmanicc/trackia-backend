const express = require("express");
const router = express.Router();
const Device = require("../models/Device");
const {
    getPositions,
    getRoute,
    sendCommand,
    getTrips
} = require("../controllers/traccarController");

const authMiddleware = require("../middleware/authMiddleware");

// ======================
// ASSIGN DEVICE TO USER
// ======================
router.post("/assign-device", authMiddleware, async (req, res) => {

    if (req.user.role !== "admin") {
        return res.status(403).json({ error: "Only admin can assign devices" });
    }

    const { deviceId, userId } = req.body;

    if (!deviceId || !userId) {
        return res.status(400).json({ error: "Missing deviceId or userId" });
    }

    try {

        const device = await Device.findById(deviceId);

        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }

        // 🔐 Same company check
        if (device.companyId.toString() !== req.user.companyId) {
            return res.status(403).json({ error: "Not allowed" });
        }

        device.assignedTo.addToSet(userId);
        await device.save();

        res.json({ success: true, device });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Assignment failed" });
    }
});

// ======================
// ADD DEVICE (ADMIN ONLY)
// ======================

console.log("Traccar routes loaded");
// ======================
// POSITIONS
// ======================
router.get("/positions", authMiddleware, getPositions);


// ======================
// ROUTE HISTORY
// ======================
router.get("/route", authMiddleware, getRoute);


// ======================
// TRIPS
// ======================
router.get("/trips", authMiddleware, getTrips);


// ======================
// COMMAND
// ======================
router.post("/command", authMiddleware, sendCommand);


module.exports = router;
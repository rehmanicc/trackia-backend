const express = require("express");
const router = express.Router();
const Device = require("../models/Device");
const axios = require("axios");
const {
    getDevices,
    getPositions,
    getRoute,
    sendCommand,
    getTrips
} = require("../controllers/traccarController");

const authMiddleware = require("../middleware/authMiddleware");


// ======================
// GET DEVICES (FILTERED)
// ======================
router.get("/devices", authMiddleware, getDevices);
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

        device.assignedTo = userId;

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
router.post("/devices", authMiddleware, async (req, res) => {

    if (req.user.role !== "admin") {
        return res.status(403).json({ error: "Only admin can add devices" });
    }

    const { name, uniqueId } = req.body;

    if (!name || !uniqueId) {
        return res.status(400).json({ error: "Missing fields" });
    }

    try {

        // 🔹 Prevent duplicate IMEI
        const exists = await Device.findOne({ uniqueId });
        if (exists) {
            return res.status(400).json({ error: "Device already exists" });
        }

        // 🔹 Create in Traccar
        const traccarRes = await axios.post(
            `${process.env.TRACCAR_URL}/api/devices`,
            { name, uniqueId },
            {
                auth: {
                    username: process.env.TRACCAR_EMAIL,
                    password: process.env.TRACCAR_PASSWORD
                }
            }
        );

        const traccarDevice = traccarRes.data;

        // 🔹 Save in DB
        const device = new Device({
            name,
            uniqueId,
            traccarId: traccarDevice.id,
            companyId: req.user.companyId, // 🔥 secure
            createdBy: req.user.id
        });

        await device.save();

        res.json({ success: true, device });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Failed to create device" });
    }
});

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
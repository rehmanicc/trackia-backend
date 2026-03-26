const express = require("express");
const router = express.Router();

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
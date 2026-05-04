const express = require("express");
const router = express.Router();
const Alert = require("../models/Alert");
const auth = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/checkPermission");
const PERMISSIONS = require("../config/permissions");

// ✅ GET ALERTS (with filters)
router.get("/", auth, async (req, res) => {

    try {
        const { deviceId, type, from, to } = req.query;

        const query = {};

        const Device = require("../models/Device");

        // 🔍 1. GET USER DEVICES FIRST
        const devices = await Device.find({
            $or: [
                { assignedUsers: req.user.id },
                { adminId: req.user.id }
            ]
        });

        const deviceIds = devices.map(d => String(d.traccarId));

        // 🔐 2. APPLY DEVICE FILTER SAFELY
        if (deviceId) {
            if (!deviceIds.includes(String(deviceId))) {
                return res.json([]); // no access
            }
            query.deviceId = deviceId;
        } else {
            query.deviceId = { $in: deviceIds };
        }

        // 🔍 3. OTHER FILTERS
        if (type) query.type = type;

        if (from || to) {
            query.timestamp = {};
            if (from) query.timestamp.$gte = new Date(from);
            if (to) query.timestamp.$lte = new Date(to);
        }

        // ✅ 4. FETCH ALERTS
        const alerts = await Alert.find(query)
            .sort({ timestamp: -1 })
            .limit(100);

        res.json(alerts);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch alerts" });
    }
});

router.put("/:id/read",
    auth,
    checkPermission(PERMISSIONS.MARK_ALERTS), async (req, res) => {
        try {
            const Device = require("../models/Device");

            const devices = await Device.find({
                $or: [
                    { assignedUsers: req.user.id },
                    { adminId: req.user.id }
                ]
            });

            const deviceIds = devices.map(d => String(d.traccarId));

            const alert = await Alert.findOneAndUpdate(
                {
                    _id: req.params.id,
                    deviceId: { $in: deviceIds }
                },
                { read: true },
                { new: true }
            );

            if (!alert) {
                return res.status(404).json({ error: "Alert not found" });
            }

            res.json(alert);

        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

router.put("/read-all",
    auth,
    checkPermission(PERMISSIONS.MARK_ALERTS),
    async (req, res) => {
        try {
            const Device = require("../models/Device");

            const devices = await Device.find({
                $or: [
                    { assignedUsers: req.user.id },
                    { adminId: req.user.id }
                ]
            });

            const deviceIds = devices.map(d => String(d.traccarId));

            await Alert.updateMany(
                {
                    deviceId: { $in: deviceIds },
                    read: false
                },
                { read: true }
            );

            res.json({ message: "All alerts marked as read" });

        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
router.delete("/clear",
    auth,
    checkPermission(PERMISSIONS.CLEAR_ALERTS),
    async (req, res) => {
        try {
            const Device = require("../models/Device");

            const devices = await Device.find({
                $or: [
                    { assignedUsers: req.user.id },
                    { adminId: req.user.id }
                ]
            });

            const deviceIds = devices.map(d => String(d.traccarId));

            await Alert.deleteMany({
                deviceId: { $in: deviceIds }
            });

            res.json({ message: "All alerts cleared" });

        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
module.exports = router;
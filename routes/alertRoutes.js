const express = require("express");
const router = express.Router();
const Alert = require("../models/Alert");
const auth = require("../middleware/authMiddleware");

// ✅ GET ALERTS (with filters)
router.get("/", auth, async (req, res) => {

    try {
        const { deviceId, type, from, to } = req.query;

        const query = {};

        if (deviceId) query.deviceId = deviceId;
        if (type) query.type = type;

        if (from || to) {
            query.timestamp = {};
            if (from) query.timestamp.$gte = new Date(from);
            if (to) query.timestamp.$lte = new Date(to);
        }

        const alerts = await Alert.find(query)
            .sort({ timestamp: -1 })
            .limit(100);

        res.json(alerts);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch alerts" });
    }
});

module.exports = router;
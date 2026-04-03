// controllers/analyticsController.js

const analyticsService = require("../services/analyticsService");

exports.getReport = async (req, res) => {

    try {
        const { deviceId, geofenceId, from, to } = req.query;

        const data = await analyticsService.getAnalyticsSummary({
            deviceId,
            geofenceId,
            from,
            to
        });

        res.json(data);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Analytics failed" });
    }
};
exports.getDailyReport = async (req, res) => {
    try {
        const { deviceId, geofenceId, from, to } = req.query;

        const data = await analyticsService.getDailyTime({
            deviceId,
            geofenceId,
            from,
            to
        });

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: "Daily analytics failed" });
    }
};
exports.getTopGeofences = async (req, res) => {
    try {
        const { deviceId, geofenceId, from, to } = req.query;

        const data = await analyticsService.getTopGeofences({
            deviceId,
            geofenceId,
            from,
            to
        });

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: "Top geofence analytics failed" });
    }
};
exports.getDeviceSummary = async (req, res) => {
    try {
        const { deviceId, geofenceId, from, to } = req.query;
        const data = await analyticsService.getDeviceSummary({
            deviceId,
            geofenceId,
            from,
            to
        });
        res.json(data);

    } catch (err) {
        res.status(500).json({ error: "Device summary failed" });
    }
};
const Position = require("../models/Position");

// 🔥 DISTANCE FUNCTION
function getDistance(p1, p2) {
    const R = 6371;

    const dLat = (p2.latitude - p1.latitude) * Math.PI / 180;
    const dLon = (p2.longitude - p1.longitude) * Math.PI / 180;

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(p1.latitude * Math.PI / 180) *
        Math.cos(p2.latitude * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

exports.getTripAnalytics = async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { start, end } = req.query;

        if (!start || !end) {
            return res.status(400).json({ message: "Start and End required" });
        }

        const positions = await Position.find({
            deviceId: Number(deviceId),
            deviceTime: {
                $gte: new Date(start),
                $lte: new Date(end)
            }
        }).sort({ deviceTime: 1 });

        if (!positions.length) {
            return res.json({ positions: [], stats: {} });
        }

        let totalDistance = 0;
        let maxSpeed = 0;
        let stops = 0;
        let stopStart = null;

        for (let i = 1; i < positions.length; i++) {
            const prev = positions[i - 1];
            const curr = positions[i];

            totalDistance += getDistance(prev, curr);

            if (curr.speed > maxSpeed) maxSpeed = curr.speed;

            // 🚗 STOP LOGIC
            if (curr.speed < 5) {
                if (!stopStart) stopStart = curr;
            } else {
                if (stopStart) {
                    const duration =
                        (new Date(curr.deviceTime) - new Date(stopStart.deviceTime)) / 60000;

                    if (duration >= 2) stops++;
                    stopStart = null;
                }
            }
        }

        const timeHours =
            (new Date(end) - new Date(start)) / (1000 * 60 * 60);

        const avgSpeed = totalDistance / (timeHours || 1);

        res.json({
            positions,
            stats: {
                distance: totalDistance,
                avgSpeed,
                maxSpeed,
                stops
            }
        });

    } catch (err) {
        console.error("❌ Trip Analytics error:", err);
        res.status(500).json({ message: "Server error" });
    }
};
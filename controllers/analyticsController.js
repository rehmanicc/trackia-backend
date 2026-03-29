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
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
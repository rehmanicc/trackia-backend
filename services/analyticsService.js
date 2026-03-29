// services/analyticsService.js

const GeofenceEvent = require("../models/GeofenceEvent");

async function getGeofenceDurations({ deviceId, geofenceId, from, to }) {

    const query = {};

    if (deviceId) query.deviceId = deviceId;
    if (geofenceId) query.geofenceId = geofenceId;

    if (from || to) {
        query.timestamp = {};
        if (from) query.timestamp.$gte = new Date(from);
        if (to) query.timestamp.$lte = new Date(to);
    }

    const events = await GeofenceEvent.find(query)
        .sort({ timestamp: 1 });

    const sessions = [];

    let activeEnter = null;

    for (const event of events) {

        if (event.type === "ENTER") {
    if (!activeEnter) {
        activeEnter = event;
    }
}

        if (event.type === "EXIT" && activeEnter) {

            const duration =
                new Date(event.timestamp) - new Date(activeEnter.timestamp);

            sessions.push({
                deviceId: event.deviceId,
                geofenceId: event.geofenceId,
                enterTime: activeEnter.timestamp,
                exitTime: event.timestamp,
                durationMs: duration,
                durationMinutes: Math.floor(duration / 60000)
            });

            activeEnter = null;
        }
    }

    return sessions;
}
async function getVisitCount({ deviceId, geofenceId, from, to }) {

    const query = {
        type: "ENTER"
    };

    if (deviceId) query.deviceId = deviceId;
    if (geofenceId) query.geofenceId = geofenceId;

    if (from || to) {
        query.timestamp = {};
        if (from) query.timestamp.$gte = new Date(from);
        if (to) query.timestamp.$lte = new Date(to);
    }

    const count = await GeofenceEvent.countDocuments(query);

    return count;
}
async function getAnalyticsSummary({ deviceId, geofenceId, from, to }) {

    const sessions = await getGeofenceDurations({
        deviceId,
        geofenceId,
        from,
        to
    });

    const totalTime = sessions.reduce((sum, s) => sum + s.durationMs, 0);
    const visits = await getVisitCount({
        deviceId,
        geofenceId,
        from,
        to
    });
    return {
        totalVisits: visits,
        totalTimeMs: totalTime,
        totalTimeMinutes: Math.floor(totalTime / 60000),
        sessions
    };
}

module.exports = {
    getGeofenceDurations,
    getVisitCount,
    getAnalyticsSummary
};
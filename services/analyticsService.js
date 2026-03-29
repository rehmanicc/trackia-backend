

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
            activeEnter = event;
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
    // ✅ HANDLE MISSING EXIT (ADD HERE)

    if (activeEnter) {
        const now = new Date();

        const duration =
            now - new Date(activeEnter.timestamp);

        sessions.push({
            deviceId: activeEnter.deviceId,
            geofenceId: activeEnter.geofenceId,
            enterTime: activeEnter.timestamp,
            exitTime: now,
            durationMs: duration,
            durationMinutes: Math.floor(duration / 60000)
        });
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
async function getDailyTime({ deviceId, geofenceId, from, to }) {

    const sessions = await getGeofenceDurations({
        deviceId,
        geofenceId,
        from,
        to
    });

    const dailyMap = {};

    sessions.forEach(session => {

        const day = new Date(session.enterTime)
            .toISOString()
            .split("T")[0]; // YYYY-MM-DD

        if (!dailyMap[day]) {
            dailyMap[day] = 0;
        }

        dailyMap[day] += session.durationMs;
    });

    // Convert to array
    return Object.entries(dailyMap)
        .map(([date, duration]) => ({
            date,
            totalTimeMinutes: Math.floor(duration / 60000)
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
}
async function getTopGeofences({ deviceId, geofenceId, from, to }) {

    const match = { type: "ENTER" };
    if (deviceId) match.deviceId = deviceId;
    if (geofenceId) match.geofenceId = geofenceId;
    if (from || to) {
        match.timestamp = {};
        if (from) match.timestamp.$gte = new Date(from);
        if (to) match.timestamp.$lte = new Date(to);
    }

    const result = await GeofenceEvent.aggregate([
        { $match: match },
        {
            $group: {
                _id: "$geofenceId",
                visits: { $sum: 1 }
            }
        },
        { $sort: { visits: -1 } },
        { $limit: 10 }
    ]);

    return result;
}
async function getDeviceSummary({ deviceId, geofenceId, from, to }) {

    const match = {};
    if (deviceId) match.deviceId = deviceId;
    if (geofenceId) match.geofenceId = geofenceId;
    if (from || to) {
        match.timestamp = {};
        if (from) match.timestamp.$gte = new Date(from);
        if (to) match.timestamp.$lte = new Date(to);
    }

    const result = await GeofenceEvent.aggregate([
        { $match: match },
        {
            $group: {
                _id: "$deviceId",
                totalEvents: { $sum: 1 },
                enters: {
                    $sum: {
                        $cond: [{ $eq: ["$type", "ENTER"] }, 1, 0]
                    }
                },
                exits: {
                    $sum: {
                        $cond: [{ $eq: ["$type", "EXIT"] }, 1, 0]
                    }
                }
            }
        },
        { $sort: { totalEvents: -1 } }
    ]);

    return result;
}
module.exports = {
    getGeofenceDurations,
    getVisitCount,
    getAnalyticsSummary,
    getDailyTime,
    getTopGeofences,
    getDeviceSummary
};
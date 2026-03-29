const GeofenceEvent = require("../models/GeofenceEvent");

async function saveGeofenceEvent(event) {
    try {

        const lastEvent = await GeofenceEvent.findOne({
            deviceId: event.deviceId,
            geofenceId: event.geofenceId,
            type: event.type
        }).sort({ timestamp: -1 });

        if (lastEvent) {
            const diff = (new Date(event.timestamp) - lastEvent.timestamp) / 1000;

            if (diff < 30) {
                console.log("⚠️ Duplicate event ignored");
                return false;
            }
        }

        await GeofenceEvent.create({
            deviceId: event.deviceId,
            geofenceId: event.geofenceId,
            type: event.type,
            timestamp: event.timestamp,
            position: event.position
        });

        return true;

    } catch (err) {
        console.error("❌ Error saving geofence event:", err.message);
        return false;
    }
}

module.exports = {
    saveGeofenceEvent
};
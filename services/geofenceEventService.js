const GeofenceEvent = require("../models/GeofenceEvent");
const { createAlert } = require("./alert/alertService");
async function saveGeofenceEvent(event, io) {
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

        // ✅ FIX: pass io
        await createAlert({
            deviceId: event.deviceId,
            type: event.type === "ENTER" ? "GEOFENCE_ENTER" : "GEOFENCE_EXIT",
            message:
                event.type === "ENTER"
                    ? `Vehicle ${event.deviceId} entered geofence`
                    : `Vehicle ${event.deviceId} exited geofence`,
            metadata: { geofenceId: event.geofenceId },
            priority: event.type === "EXIT" ? "high" : "medium"
        }, io);

        return true; // ✅ VERY IMPORTANT

    } catch (err) {
        console.error("❌ Error saving geofence event:", err.message);
        return false;
    }
}

module.exports = {
    saveGeofenceEvent
};
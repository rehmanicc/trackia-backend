const GeofenceEvent = require("../models/GeofenceEvent");
const { createAlert } = require("./alert/alertService");
const Geofence = require("../models/Geofence");
async function saveGeofenceEvent(event, io) {
    try {

        const lastEvent = await GeofenceEvent.findOne({
            deviceId: String(event.deviceId),
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
            deviceId: String(event.deviceId),
            geofenceId: event.geofenceId,
            type: event.type,
            timestamp: event.timestamp,
            position: event.position
        });

        const geo = await Geofence.findById(event.geofenceId);
        const geoName = geo?.name || "geofence";

        const result = await createAlert({
            deviceId: String(event.deviceId),
            type: event.type === "ENTER" ? "GEOFENCE_ENTER" : "GEOFENCE_EXIT",
            message:
                event.type === "ENTER"
                    ? `Vehicle ${event.deviceId} entered ${geoName}`
                    : `Vehicle ${event.deviceId} exited ${geoName}`,
            metadata: {
                geofenceId: event.geofenceId,
                geofenceName: geoName // 🔥 ADD THIS
            },
            priority: "medium"
        }, io);

        console.log("🚨 ALERT RESULT:", result);
        return true;

    } catch (err) {
        console.error("❌ Error saving geofence event:", err.message);
        return false;
    }
}

module.exports = {
    saveGeofenceEvent
};
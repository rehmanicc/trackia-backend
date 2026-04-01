const Alert = require("../../models/Alert");
const { detectAlerts } = require("./alertRules");

// 🔥 Prevent duplicate spam
const lastAlertTime = {};
const deviceFenceState = {};

const COOLDOWN = 15000; // 15 seconds

async function processPosition(position, io) {

    const alerts = detectAlerts(position);
    // ================= GEOFENCE CHECK =================

    const deviceId = position.deviceId;

    // 🔥 You must fetch geofences for this device
    const Geofence = require("../../models/Geofence");

    const geofences = await Geofence.find({ deviceId });

    // Helper function (basic point-in-polygon or circle check)
    function isInsideFence(pos, fence) {
        const { latitude, longitude } = pos;

        if (fence.type === "Polygon") {
            const turf = require("@turf/turf");

            const point = turf.point([longitude, latitude]);
            const polygon = turf.polygon(fence.geometry.coordinates);

            return turf.booleanPointInPolygon(point, polygon);
        }

        if (fence.type === "Point") {
            // circle (if you are using circle)
            const [lng, lat] = fence.geometry.coordinates;
            const radius = fence.geometry.radius || 100;

            const distance = require("@turf/turf").distance(
                [longitude, latitude],
                [lng, lat],
                { units: "meters" }
            );

            return distance <= radius;
        }

        return false;
    }

    // Check if inside ANY fence
    let isInside = false;
    let currentFenceId = null;

    for (const fence of geofences) {
        if (isInsideFence(position, fence)) {
            isInside = true;
            currentFenceId = fence._id;
            break;
        }
    }

    // Previous state
    const prevState = deviceFenceState[deviceId];

    // FIRST TIME
    if (!prevState) {
        deviceFenceState[deviceId] = {
            inside: isInside,
            fenceId: currentFenceId
        };
    } else {

        // 🚪 EXIT
        if (prevState.inside === true && isInside === false) {

            const alertDoc = await Alert.create({
                deviceId,
                type: "GEOFENCE_EXIT",
                message: `Vehicle ${deviceId} exited geofence`,
                metadata: { geofenceId: prevState.fenceId } // ✅ IMPORTANT
            });

            io.emit("alert", alertDoc);
        }

        // 🚗 ENTER
        if (prevState.inside === false && isInside === true) {

            const alertDoc = await Alert.create({
                deviceId,
                type: "GEOFENCE_ENTER",
                message: `Vehicle ${deviceId} entered geofence`,
                metadata: { geofenceId: currentFenceId }
            });

            io.emit("alert", alertDoc);
        }

        // UPDATE STATE
        deviceFenceState[deviceId] = {
            inside: isInside,
            fenceId: currentFenceId
        };
    }

    for (const alert of alerts) {

        const key = `${position.deviceId}_${alert.type}`;
        const now = Date.now();

        // ✅ COOLDOWN CHECK
        if (lastAlertTime[key] && (now - lastAlertTime[key] < COOLDOWN)) {
            continue;
        }

        lastAlertTime[key] = now;

        // ✅ SAVE TO DB
        const alertDoc = await Alert.create({
            deviceId: position.deviceId,
            type: alert.type,
            message: alert.message,
            metadata: alert.metadata || {}
        });

        // ✅ EMIT REAL-TIME ALERT
        io.emit("alert", alertDoc);

        console.log("🚨 ALERT:", alert.type, position.deviceId);
    }
}

module.exports = { processPosition };
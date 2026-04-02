const turf = require("@turf/turf");
const Geofence = require("../models/Geofence");
const { saveGeofenceEvent } = require("./geofenceEventService");
const { createAlert } = require("./alert/alertService");
const { detectAlerts } = require("./alert/alertRules");
let vehicleStates = {};

// MAIN ENGINE
async function processPosition(position, io) {

    const deviceId = String(position.deviceId);
    const { latitude, longitude } = position;
    const point = turf.point([longitude, latitude]);

    // 🔥 Get geofences for this device
    const geofences = await Geofence.find({ deviceId });

    for (const f of geofences) {

        const geofenceId = f._id.toString();

        // 🔥 STEP 1: FAST BBOX CHECK
        if (!f || !f.geometry || !f.geometry.coordinates) {
            console.log("❌ Invalid geofence skipped:", f._id);
            continue;
        }
        const bbox = turf.bbox({
            type: "Feature",
            geometry: f.geometry
        });
        const [minLng, minLat, maxLng, maxLat] = bbox;

        if (
            longitude < minLng || longitude > maxLng ||
            latitude < minLat || latitude > maxLat
        ) {
            continue;
        }

        // 🔥 STEP 2: PRECISE CHECK
        let inside = false;

        if (f.type === "Polygon") {
            inside = turf.booleanPointInPolygon(point, f.geometry);
        }
        else if (f.type === "Point") {
            const [lng, lat] = f.geometry.coordinates;
            const radius = f.geometry.radius || 100;

            const distance = turf.distance(
                [longitude, latitude],
                [lng, lat],
                { units: "meters" }
            );

            inside = distance <= radius;
        }        // ================= STATE INIT =================
        if (!vehicleStates[deviceId]) {
            vehicleStates[deviceId] = {};
        }

        if (!vehicleStates[deviceId][geofenceId]) {
            vehicleStates[deviceId][geofenceId] = {
                inside,
                lastUpdate: Date.now(),
                enterCount: 0,
                exitCount: 0
            };
            continue;
        }

        const state = vehicleStates[deviceId][geofenceId];
        const previous = state.inside;

        const CONFIRM_COUNT = 3;
        const COOLDOWN = 10000;

        // ================= ENTER =================
        if (inside) {
            state.enterCount++;
            state.exitCount = 0;

            if (!previous && state.enterCount >= CONFIRM_COUNT) {

                if (Date.now() - state.lastUpdate < COOLDOWN) continue;

                state.inside = true;
                state.lastUpdate = Date.now();
                state.enterCount = 0;

                 await emitEvent(io, deviceId, geofenceId, "enter", {
                    lat: latitude,
                    lng: longitude
                });
            }
        }

        // ================= EXIT =================
        else {
            state.exitCount++;
            state.enterCount = 0;

            if (previous && state.exitCount >= CONFIRM_COUNT) {

                if (Date.now() - state.lastUpdate < COOLDOWN) continue;

                state.inside = false;
                state.lastUpdate = Date.now();
                state.exitCount = 0;

                await emitEvent(io, deviceId, geofenceId, "exit", {
                    lat: latitude,
                    lng: longitude
                });
            }
        }
    }
    const alerts = detectAlerts(position);

    for (const alert of alerts) {
        await createAlert({
            deviceId: position.deviceId,
            type: alert.type,
            message: alert.message,
            metadata: alert.metadata || {}
        }, io);
    }
}
// EMIT EVENT

async function emitEvent(io, deviceId, geofenceId, type, position) {

    const event = {
        deviceId,
        geofenceId,
        type: type.toUpperCase(),
        timestamp: new Date(),
        position
    };

    await saveGeofenceEvent(event);
    await createAlert({
        deviceId,
        type: type === "enter" ? "ENTER_FENCE" : "EXIT_FENCE",
        message: `Vehicle ${deviceId} ${type.toUpperCase()} geofence`,
        metadata: {
            geofenceId
        }
    }, io);
    // ✅ 4. KEEP OLD EVENT (ONLY FOR UI VISUAL)
    io.emit("geofenceEvent", {
        deviceId,
        geofenceId,
        type,
        time: event.timestamp
    });
    console.log(`🚧 ${type.toUpperCase()} → Device ${deviceId} Geofence ${geofenceId}`);
}


module.exports = { processPosition };
const turf = require("@turf/turf");
const Geofence = require("../models/Geofence");
const Position = require("../models/Position");

// 🔥 In-memory state
let vehicleStates = {};

// MAIN ENGINE
async function processPosition(position, io) {

    const { deviceId, latitude, longitude } = position;

    const point = turf.point([longitude, latitude]);

    // 🔥 Get geofences for this device
    const geofences = await Geofence.find({ deviceId });

    for (const f of geofences) {

        const geofenceId = f._id.toString();

        const inside = turf.booleanPointInPolygon(point, f);

        // INIT
        if (!vehicleStates[deviceId]) {
            vehicleStates[deviceId] = {};
        }

        if (!vehicleStates[deviceId][geofenceId]) {
            vehicleStates[deviceId][geofenceId] = {
                inside,
                lastUpdate: Date.now()
            };
            continue;
        }

        const state = vehicleStates[deviceId][geofenceId];
        const previous = state.inside;

        // ENTER
        if (!previous && inside) {
            state.inside = true;
            state.lastUpdate = Date.now();

            emitEvent(io, deviceId, geofenceId, "enter");
        }

        // EXIT
        if (previous && !inside) {
            state.inside = false;
            state.lastUpdate = Date.now();

            emitEvent(io, deviceId, geofenceId, "exit");
        }
    }
}

// EMIT EVENT
function emitEvent(io, deviceId, geofenceId, type) {

    io.emit("geofenceEvent", {
        deviceId,
        geofenceId,
        type,
        time: new Date()
    });

    console.log(`🚧 ${type.toUpperCase()} → Device ${deviceId} Geofence ${geofenceId}`);
}

module.exports = { processPosition };
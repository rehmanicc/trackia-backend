const turf = require("@turf/turf");
const Geofence = require("../models/Geofence");
const { saveGeofenceEvent } = require("./geofenceEventService");
let vehicleStates = {};
const Device = require("../models/Device");

// MAIN ENGINE
async function processPosition(position, io) {
    console.log("📍 Processing position:", position.deviceId, position.latitude, position.longitude);
    const device = await Device.findOne(
        { traccarId: position.deviceId },
        { speedLimit: 1 }
    );
    const deviceId = String(position.deviceId);
    const { latitude, longitude } = position;
    const point = turf.point([longitude, latitude]);
    const geofences = await Geofence.find({ deviceId });
    // 🔥 LOAD LAST EVENTS ONCE (PER DEVICE)
    const GeofenceEvent = require("../models/GeofenceEvent");

    const lastEvents = await GeofenceEvent.aggregate([
        { $match: { deviceId: String(position.deviceId) } },
        { $sort: { timestamp: -1 } },
        {
            $group: {
                _id: "$geofenceId",
                lastEvent: { $first: "$type" }
            }
        }
    ]);

    const lastEventMap = {};
    lastEvents.forEach(e => {
        lastEventMap[e._id.toString()] = e.lastEvent;
    });
    position.deviceConfig = {
        speedLimit: device?.speedLimit || 60
    };
    console.log("🧱 Geofences found:", geofences.length, "for device:", deviceId);
    for (const f of geofences) {

        const geofenceId = f._id.toString();
        if (!f || !f.geometry || !f.geometry.coordinates) {
            console.log("❌ Invalid geofence skipped:", f._id);
            continue;
        }
        const bbox = turf.bbox({
            type: "Feature",
            geometry: f.geometry
        });
        const [minLng, minLat, maxLng, maxLat] = bbox;
        let inside = false;

        if (
            longitude >= minLng && longitude <= maxLng &&
            latitude >= minLat && latitude <= maxLat
        ) {
            if (f.type === "Polygon") {
                inside = turf.booleanPointInPolygon(point, f.geometry);
            } else {
                const [lng, lat] = f.geometry.coordinates;
                const radius = f.geometry.radius || 100;

                const distance = turf.distance(
                    [longitude, latitude],
                    [lng, lat],
                    { units: "meters" }
                );

                inside = distance <= radius;
            }
        }
        // ================= STATE INIT =================
        if (!vehicleStates[deviceId]) {
            vehicleStates[deviceId] = {};
        }

        if (!vehicleStates[deviceId][geofenceId]) {

            const lastEventType = lastEventMap[geofenceId];

            let lastInside = inside;

            if (lastEventType) {
                lastInside = lastEventType === "ENTER";
            }

            vehicleStates[deviceId][geofenceId] = {
                inside: lastInside,
                initialized: true,
                lastUpdate: Date.now(),
                enterCount: 0,
                exitCount: 0
            };

            console.log("♻️ State restored from DB:", {
                deviceId,
                geofenceId,
                lastInside
            });

            continue;
        }
        const state = vehicleStates[deviceId][geofenceId];
        const previous = state.inside;
        // 🔥 HANDLE FIRST REAL STATE (NO EVENT)

        console.log("📊 GEOFENCE CHECK:", {
            deviceId,
            geofenceId,
            inside,
            previous,
            lat: latitude,
            lng: longitude
        });

        if (inside && !previous) {
            state.inside = true;

            await emitEvent(io, deviceId, geofenceId, "enter", {
                lat: latitude,
                lng: longitude
            });
        }

        if (!inside && previous) {
            state.inside = false;

            await emitEvent(io, deviceId, geofenceId, "exit", {
                lat: latitude,
                lng: longitude
            });
        }
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

    const saved = await saveGeofenceEvent(event, io);


    if (!saved) return;


    const Device = require("../models/Device");
    const User = require("../models/User");

    // 🔍 find device
    const device = await Device.findOne({
        traccarId: deviceId
    });

    if (!device) return;

    // 🔍 get users (assigned + admin)
    const users = await User.find({
        _id: { $in: [device.assignedUsers, device.adminId] }
    });

    // 🔥 send only to relevant users
    for (const user of users) {
        io.to(`user_${user._id}`).emit("geofenceEvent", {
            deviceId,
            geofenceId,
            type,
            time: event.timestamp
        });
    }
    console.log(`🚧 ${type.toUpperCase()} → Device ${deviceId} Geofence ${geofenceId}`);
}


module.exports = { processPosition };
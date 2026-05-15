// 🔥 In-memory state (per device)
const vehicleState = {};
const ALERT_PRIORITY = {
    OVERSPEED: "high",
    GEOFENCE_EXIT: "high",
    BATTERY_DISCONNECTED: "high",

    GEOFENCE_ENTER: "medium",

    ENGINE_ON: "low",
    ENGINE_OFF: "low"
};
async function detectAlerts(position) {

    const alerts = [];

    const {
        deviceId,
        speed = 0,
        attributes = {}
    } = position;

    // ✅ INIT STATE
    if (!vehicleState[deviceId]) {
        vehicleState[deviceId] = {
            engineOn: false,
            batteryConnected: true
        };
    }
    const state = vehicleState[deviceId];

    // ================= IGNITION =================

    const ignition =
        attributes?.ignition === true ||
        attributes?.ignition === 1 ||
        attributes?.ignition === "1";

    // ENGINE ON
    if (ignition && !state.engineOn) {

        alerts.push({
            type: "ENGINE_ON",
            message: `Vehicle ${deviceId} Engine ON`
        });

        state.engineOn = true;
    }

    // ENGINE OFF
    if (!ignition && state.engineOn) {

        alerts.push({
            type: "ENGINE_OFF",
            message: `Vehicle ${deviceId} Engine OFF`
        });

        state.engineOn = false;
    }

    
        // ================= BATTERY DISCONNECTED =================

    const batteryLevel =
        Number(attributes?.batteryLevel);

    const externalPower =
        Number(attributes?.power);

    const batteryDisconnected =
        batteryLevel === 0 ||
        externalPower === 0;

    if (
        batteryDisconnected &&
        state.batteryConnected
    ) {

        alerts.push({
            type: "BATTERY_DISCONNECTED",
            message: `Vehicle ${deviceId} Battery Disconnected`,
            metadata: {
                batteryLevel,
                externalPower,
            }
        });

        state.batteryConnected = false;
    }

    // ================= BATTERY RESTORE =================

    if (
        batteryLevel > 0 ||
        externalPower > 0
    ) {
        state.batteryConnected = true;
    }

    // ================= BATTERY RESTORE =================
    if (attributes.batteryLevel > 0) {
        state.batteryConnected = true;
    }
    // ================= OVERSPEED =================


    const Device = require("../../models/Device");

    let speedLimit = 70;

    const device = await Device.findOne({ traccarId: deviceId });

    if (device?.speedLimit) {
        speedLimit = device.speedLimit;
    }

    const speedKmh = speed * 1.852;

    // init state
    if (!state.lastOverspeedTime) {
        state.lastOverspeedTime = 0;
    }

    // cooldown (prevent spam)
    const COOLDOWN = 15000; // 15 sec

    if (speedKmh > speedLimit) {

        const now = Date.now();

        if (now - state.lastOverspeedTime > COOLDOWN) {

            alerts.push({
                type: "OVERSPEED",
                message: `Vehicle ${deviceId} Overspeed (${Math.round(speedKmh)} km/h)`,
                metadata: {
                    speed: Math.round(speedKmh),
                    limit: speedLimit
                },
            });

            state.lastOverspeedTime = now;
        }
    }
    alerts.forEach(a => {
        a.priority = ALERT_PRIORITY[a.type] || "medium";
    });
    return alerts;
}

module.exports = { detectAlerts };
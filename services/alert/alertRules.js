// 🔥 In-memory state (per device)
const vehicleState = {};

function detectAlerts(position) {

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

    // ================= ENGINE ON =================
    if (speed > 5 && !state.engineOn) {

        alerts.push({
            type: "ENGINE_ON",
            message: `Vehicle ${deviceId} Engine ON`
        });

        state.engineOn = true;
    }

    // ================= ENGINE OFF =================
    if (speed === 0 && state.engineOn) {

        alerts.push({
            type: "ENGINE_OFF",
            message: `Vehicle ${deviceId} Engine OFF`
        });

        state.engineOn = false;
    }

    // ================= BATTERY DISCONNECTED =================
    if (attributes.batteryLevel === 0 && state.batteryConnected) {

        alerts.push({
            type: "BATTERY_DISCONNECTED",
            message: `Vehicle ${deviceId} Battery Disconnected`,
            metadata: {
                batteryLevel: 0
            }
        });

        state.batteryConnected = false;
    }

    // ================= BATTERY RESTORE =================
    if (attributes.batteryLevel > 0) {
        state.batteryConnected = true;
    }
    // ================= OVERSPEED =================

    // Default limit
    const DEFAULT_LIMIT = 60;

    const speedLimit =
        position.deviceConfig?.speedLimit ||
        attributes.speedLimit ||
        DEFAULT_LIMIT;
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
                }
            });

            state.lastOverspeedTime = now;
        }
    }
    return alerts;
}

module.exports = { detectAlerts };
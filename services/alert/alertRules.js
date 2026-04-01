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

    return alerts;
}

module.exports = { detectAlerts };
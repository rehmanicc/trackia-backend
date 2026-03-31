const Alert = require("../models/Alert");
const { detectAlerts } = require("./alertRules");

// 🔥 Prevent duplicate spam
const lastAlertTime = {};

const COOLDOWN = 15000; // 15 seconds

async function processPosition(position, io) {

    const alerts = detectAlerts(position);

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
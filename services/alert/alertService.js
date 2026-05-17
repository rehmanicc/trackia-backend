const Alert = require("../../models/Alert");
// 🔥 Prevent duplicate spam
const { dispatch } = require("../notification/dispatcher");
const COOLDOWN = 15000; // 15 seconds

async function createAlert(alertData, io) {
    try {
        console.log("📥 createAlert called:", alertData);

        const now = new Date();
        const DUPLICATE_WINDOWS = {
            ENGINE_ON: 30000,
            ENGINE_OFF: 30000,
            BATTERY_DISCONNECTED: 300000,
            GEOFENCE_ENTER: 60000,
            GEOFENCE_EXIT: 60000,
            OVERSPEED: 15000,
        };

        const DUPLICATE_WINDOW =
            DUPLICATE_WINDOWS[
            alertData.type
            ] || 15000;

        const existing = await Alert.findOne({
            deviceId: alertData.deviceId,
            type: alertData.type,
            timestamp: {
                $gte: new Date(Date.now() - DUPLICATE_WINDOW)
            }
        });

        if (existing) {
            console.log("⚠️ Duplicate alert skipped:", alertData.type);
            return null;
        }
        const alertDoc = await Alert.create({
            deviceId: alertData.deviceId,
            type: alertData.type,
            message: alertData.message,
            metadata: alertData.metadata || {},
            timestamp: now,
            ruleId: alertData.ruleId || null,
            priority: alertData.priority || "medium"
        });

        console.log("✅ ALERT SAVED:", alertDoc);

        // ✅ SINGLE EMIT
        if (io) {
            await dispatch(alertDoc, io);
        }

        console.log("🚨 ALERT:", alertData.type, alertData.deviceId);

        return alertDoc;

    } catch (error) {
        console.error("❌ ALERT CREATION FAILED:", error);
        return null;
    }
}

module.exports = { createAlert };
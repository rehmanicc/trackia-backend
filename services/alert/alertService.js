const Alert = require("../../models/Alert");
// 🔥 Prevent duplicate spam
const { dispatch } = require("../notification/dispatcher");
const COOLDOWN = 15000; // 15 seconds
const recent = null;
async function createAlert(alertData, io) {
    try {
        console.log("📥 createAlert called:", alertData);

        const now = new Date();

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
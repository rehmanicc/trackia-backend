const Alert = require("../../models/Alert");
// 🔥 Prevent duplicate spam

const COOLDOWN = 15000; // 15 seconds
const recent = null;
const { triggerCall } = require("../callService");
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
            io.emit("alert", alertDoc);
        }

        console.log("🚨 ALERT:", alertData.type, alertData.deviceId);

        if (alertDoc.priority === "high") {
            try {
                await triggerCall(alertDoc);
            } catch (err) {
                console.error("Call trigger failed:", err);
            }
        }

        return alertDoc;

    } catch (error) {
        console.error("❌ ALERT CREATION FAILED:", error);
        return null;
    }
}

module.exports = { createAlert };
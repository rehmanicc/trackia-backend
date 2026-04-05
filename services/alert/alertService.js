const Alert = require("../../models/Alert");
// 🔥 Prevent duplicate spam

const COOLDOWN = 15000; // 15 seconds

async function createAlert(alertData, io) {
    try {

        const now = new Date();

        // ✅ CHECK RECENT DUPLICATE (KEY FIX)
        const recent = await Alert.findOne({
            deviceId: alertData.deviceId,
            type: alertData.type,
            timestamp: { $gte: new Date(Date.now() - COOLDOWN) }
        });

        if (recent) {
            return null;
        }

        const alertDoc = await Alert.create({
            deviceId: alertData.deviceId,
            type: alertData.type,
            message: alertData.message,
            metadata: alertData.metadata || {},
            timestamp: now
        });

        // ✅ Emit ONLY if new
        if (io) {
            io.emit("alert", alertDoc);
        }

        console.log("🚨 ALERT:", alertData.type, alertData.deviceId);

        return alertDoc;

    } catch (error) {
        console.error("Alert creation failed:", error);
    }
}

module.exports = { createAlert };
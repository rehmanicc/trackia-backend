const Alert = require("../../models/Alert");
// 🔥 Prevent duplicate spam

const COOLDOWN = 15000; // 15 seconds
const { triggerCall } = require("../callService");

async function createAlert(alertData, io) {
    try {

        const now = new Date();

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
            timestamp: now,

            // 🔥 NEW
            ruleId: alertData.ruleId || null,
            priority: alertData.priority || "medium"
        });

        // ✅ Emit ONLY if new
        if (io) {

            const User = require("../../models/User");

            const users = await User.find({
                // 🔥 Basic filter (can improve later)
            });

            users.forEach(user => {

                const prefs = user.alertPreferences || {};

                if (prefs[alertData.type] === false) return;

                // 🔥 Send to specific user
                io.to(String(user._id)).emit("alert", alertDoc);
            });
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
        console.error("Alert creation failed:", error);
    }
}

module.exports = { createAlert };
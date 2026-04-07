const Device = require("../models/Device");
const User = require("../models/User");

// 🔥 MAIN FUNCTION
async function triggerCall(alert) {

    try {

        // ✅ Only HIGH priority
        if (alert.priority !== "high") return;

        // ✅ Get device
        const device = await Device.findOne({
            traccarId: alert.deviceId
        }).populate("assignedTo");

        if (!device) return;

        const users = device.assignedTo || [];

        for (const user of users) {

            // ✅ Check user settings
            if (!user.callEnabled) continue;
            if (!user.phoneNumber) continue;

            // 🔥 CALL TRIGGER (SIM / PHONE)
            console.log("📞 CALL TRIGGERED:", {
                user: user.name,
                number: user.phoneNumber,
                alert: alert.type
            });

            // 👉 FUTURE: Send to phone gateway
            // await sendToPhone(user.phoneNumber, alert);

        }

    } catch (err) {
        console.error("❌ Call trigger failed:", err.message);
    }
}

module.exports = { triggerCall };
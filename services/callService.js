const Device = require("../models/Device");
const User = require("../models/User");
let pendingCalls = [];
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

        let users = [];

        if (Array.isArray(device.assignedTo)) {
            users = device.assignedTo;
        } else if (device.assignedTo) {
            users = [device.assignedTo];
        }

        for (const user of users) {

            if (!user.callEnabled) continue;
            if (!user.phoneNumber) continue;

            console.log("📞 CALL TRIGGERED:", {
                user: user.name,
                number: user.phoneNumber,
                alert: alert.type
            });

            // ✅ ADD TO QUEUE (IMPORTANT)
            pendingCalls.push({
                number: user.phoneNumber,
                alertType: alert.type,
                deviceId: alert.deviceId,
                time: Date.now()
            });
        }

    } catch (err) {
        console.error("❌ Call trigger failed:", err.message);
    }
}
function getPendingCalls() {
    return pendingCalls;
}

function clearCalls() {
    pendingCalls = [];
}

module.exports = { triggerCall, getPendingCalls, clearCalls };
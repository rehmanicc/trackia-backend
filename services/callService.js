const Device = require("../models/Device");
const User = require("../models/User");
const MAX_ATTEMPTS = 3;
const BASE_DELAY = 2000;
let isProcessing = false;
// 🔥 MAIN FUNCTION
async function triggerCall(alert) {

    try {

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

            await CallQueue.create({
                number: user.phoneNumber,
                alertType: alert.type,
                deviceId: alert.deviceId
            });
            processQueue();
        }

    } catch (err) {
        console.error("❌ Call trigger failed:", err.message);
    }

}
const CallQueue = require("../models/CallQueue");

async function processQueue() {

    if (isProcessing) return;
    isProcessing = true;

    try {

        while (true) {

            const call = await CallQueue.findOne({
                status: "pending",
                nextRetryAt: { $lte: new Date() }
            }).sort({ createdAt: 1 });

            if (!call) break;

            call.status = "processing";
            await call.save();

            try {

                console.log("📞 Processing call:", call.number);

                await makeCall(call);

                call.status = "done";
                await call.save();

            } catch (err) {

                call.attempts++;

                if (call.attempts < MAX_ATTEMPTS) {

                    const delay = call.attempts * BASE_DELAY;

                    call.status = "pending";
                    call.nextRetryAt = new Date(Date.now() + delay);

                    console.log(`🔁 Retry in ${delay / 1000}s`);

                } else {

                    call.status = "failed";
                    console.log("🚫 Dropped:", call.number);
                }

                await call.save();
            }
        }

    } catch (err) {
        console.error("Queue processing error:", err);
    }

    isProcessing = false;
}
const axios = require("axios");

async function makeCall(call) {

    const AUTOMATE_URL = "https://howard-unsymbolized-grant.ngrok-free.dev/call"; // 🔥 CHANGE THIS
    console.log("🚨 CALL TRIGGERED:", phoneNumber);
    await axios.post(AUTOMATE_URL, {
        number: call.number
    });

    console.log("📞 Real call sent:", call.number);
}
setInterval(processQueue, 2000);
module.exports = { triggerCall };
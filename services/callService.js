const MAX_ATTEMPTS = 3;
const BASE_DELAY = 2000;
let isProcessing = false;
// 🔥 MAIN FUNCTION
async function triggerCall(alert) {
    try {

        if (!alert.phoneNumber || typeof alert.phoneNumber !== "string") {
            console.log("❌ Invalid phone number");
            return;
        }

        // 🔥 COOLDOWN CHECK
        const Device = require("../models/Device");

        const device = await Device.findOne({ traccarId: alert.deviceId });

        if (device?.lastCallTime) {
            const diff = Date.now() - new Date(device.lastCallTime).getTime();

            if (diff < 60000) {
                console.log("⏳ Call skipped (cooldown)");
                return;
            }
        }

        if (device) {
            device.lastCallTime = new Date();
            await device.save();
        }

       // console.log("📞 CALL TO:", alert.phoneNumber);

        await CallQueue.create({
            number: alert.phoneNumber,
            alertType: alert.type,
            deviceId: alert.deviceId
        });

        processQueue();

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
    console.log("🚨 CALL TRIGGERED:", call.number);
    await axios.post(AUTOMATE_URL, {
        number: call.number
    });

    console.log("📞 Real call sent:", call.number);
}
setInterval(processQueue, 2000);
module.exports = { triggerCall };
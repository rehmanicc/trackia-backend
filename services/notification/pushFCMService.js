const { messaging } = require("./firebase");
const User = require("../../models/User");
const Device = require("../../models/Device");

async function sendPushFCM(alert) {
  try {
    // 🔍 Find device
    const device = await Device.findOne({
      traccarId: alert.deviceId
    });

    if (!device || !device.assignedTo) return;

    // 🔍 Find user
    const user = await User.findById(device.assignedTo);

    if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
      return;
    }

    const message = {
      notification: {
        title: "🚨 Trackia Alert",
        body: alert.message
      },
      data: {
        type: alert.type,
        deviceId: String(alert.deviceId)
      },
      tokens: user.fcmTokens
    };

    const response = await messaging.sendEachForMulticast(message);

    console.log("📲 FCM sent:", response.successCount);

  } catch (err) {
    console.error("❌ FCM error:", err.message);
  }
}

module.exports = { sendPushFCM };
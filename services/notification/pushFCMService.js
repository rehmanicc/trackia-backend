const { messaging } = require("./firebase");
const User = require("../../models/User");
const Device = require("../../models/Device");

async function sendPushFCM(alert) {
  try {
    console.log("🔥 FCM START:", alert);

    // 🔍 Find device
    const device = await Device.findOne({
      traccarId: alert.deviceId
    });

    if (!device) {
      console.log("❌ Device not found for:", alert.deviceId);
      return;
    }

    console.log("📦 Device found:", device._id);

    if (!device.assignedTo) {
      console.log("❌ Device not assigned");
      return;
    }

    // 🔍 Find user
    const user = await User.findById(device.assignedTo);

    if (!user) {
      console.log("❌ User not found");
      return;
    }

    console.log("👤 User found:", user._id);

    if (!user.fcmTokens || user.fcmTokens.length === 0) {
      console.log("❌ No FCM tokens");
      return;
    }

    console.log("📲 Tokens:", user.fcmTokens);

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
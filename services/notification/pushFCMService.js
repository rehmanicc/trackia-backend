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

    // 🔥 GET USERS (assigned user + admin)
    const users = await User.find({
      _id: {
        $in: [device.assignedTo, device.adminId]
      }
    });

    let tokens = [];

    users.forEach(u => {
      if (u.fcmTokens && u.fcmTokens.length > 0) {
        tokens.push(...u.fcmTokens);
      }
    });

    // 🔥 REMOVE DUPLICATES
    tokens = [...new Set(tokens)];

    if (tokens.length === 0) {
      console.log("❌ No FCM tokens");
      return;
    }

    console.log("📲 Tokens:", tokens);

    const message = {
      notification: {
        title: "🚨 Trackia Alert",
        body: alert.message
      },
      data: {
        type: alert.type,
        deviceId: String(alert.deviceId)
      },
      tokens
    };

    const response = await messaging.sendEachForMulticast(message);

    console.log("📲 FCM sent:", response.successCount);

  } catch (err) {
    console.error("❌ FCM error:", err.message);
  }
}

module.exports = { sendPushFCM };
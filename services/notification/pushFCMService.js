const { messaging } = require("./firebase");
const User = require("../../models/User");
const Device = require("../../models/Device");

function isAllowed(user, alertType) {
  const prefs = user.alertPreferences || {};
  return prefs[alertType] !== false;
}

async function sendPushFCM(alert) {
  try {
    console.log("🔥 FCM START:", alert);

    const device = await Device.findOne({
      traccarId: alert.deviceId
    });

    if (!device) {
      console.log("❌ Device not found for:", alert.deviceId);
      return;
    }

    const userIds = [device.assignedTo, device.adminId].filter(Boolean);

    if (userIds.length === 0) {
      console.log("❌ No users linked to device");
      return;
    }

    const users = await User.find({
      _id: { $in: userIds }
    });

    let tokens = [];

    users.forEach(u => {
      if (!isAllowed(u, alert.type)) return;

      if (u.fcmTokens?.length > 0) {
        tokens.push(...u.fcmTokens);
      }
    });

    tokens = [...new Set(tokens)];

    if (tokens.length === 0) {
      console.log("❌ No FCM tokens");
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
      tokens
    };

    const response = await messaging.sendEachForMulticast(message);

    console.log("📲 FCM sent:", response.successCount);

  } catch (err) {
    console.error("❌ FCM error:", err.message);
  }
}

module.exports = { sendPushFCM };
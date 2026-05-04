const { triggerCall } = require("../callService");
const Device = require("../../models/Device");
const User = require("../../models/User");
const { sendPushFCM } = require("./pushFCMService");

function isAllowed(user, alertType) {
  const prefs = user.alertPreferences || {};
  return prefs[alertType] !== false;
}

async function dispatch(alert, io) {
  try {

    if (!state.device) {
      state.device = await Device.findOne({ traccarId: deviceId });
    }

    const device = state.device;

    if (!device) return;

    const userIds = [
      ...(device.assignedUsers || []),
      device.adminId
    ].filter(Boolean);

    const users = await User.find({
      _id: { $in: userIds }
    });

    // ✅ SOCKET (filtered per user)
    for (const user of users) {
      if (!isAllowed(user, alert.type)) continue;

      io.to(`user_${user._id}`).emit("alert", alert);
    }

    // ✅ FCM (already filtered internally)
    await sendPushFCM(alert);

    if (!device.engineControlEnabled || !device.callReceiverNumber) return;

    if (alert.type === "BATTERY_DISCONNECTED") {
      return triggerCall({
        ...alert,
        phoneNumber: device.callReceiverNumber
      });
    }

    if (
      alert.type === "GEOFENCE_EXIT" &&
      String(alert.metadata?.geofenceId) === String(device.callGeofenceId)
    ) {
      return triggerCall({
        ...alert,
        phoneNumber: device.callReceiverNumber
      });
    }

  } catch (err) {
    console.error("❌ Dispatch error:", err.message);
  }
}

module.exports = { dispatch };
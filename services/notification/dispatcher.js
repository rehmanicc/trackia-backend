const { sendPush } = require("./pushService");
const { triggerCall } = require("../callService");
const Device = require("../../models/Device");
const { sendPushFCM } = require("./pushFCMService");
async function dispatch(alert, io) {

    // ✅ Web push
    sendPush(io, alert);

    // ✅ ALWAYS send mobile push (independent)
    await sendPushFCM(alert);

    const device = await Device.findOne({
        traccarId: alert.deviceId
    });

    if (!device || !device.callEnabled) return;

    // 📞 Battery → always call
    if (alert.type === "BATTERY_DISCONNECTED") {
        return triggerCall(alert);
    }

    // 📞 Geofence → only selected
    if (
        alert.type === "GEOFENCE_EXIT" &&
        alert.metadata?.geofenceId === device.callGeofenceId
    ) {
        return triggerCall(alert);
    }
}
module.exports = { dispatch };
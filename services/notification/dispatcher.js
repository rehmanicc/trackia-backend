const { sendPush } = require("./pushService");
const { sendSMS } = require("./smsService");
const { triggerCall } = require("../callService");
const Device = require("../../models/Device");
const { sendPushFCM } = require("./pushFCMService");
async function dispatch(alert, io) {

    sendPush(io, alert);

    const device = await Device.findOne({
        traccarId: alert.deviceId
    });

    if (!device || !device.callEnabled) return;

    if (alert.type === "BATTERY_DISCONNECTED") {
        return triggerCall(alert);
    }

    if (
        alert.type === "GEOFENCE_EXIT" &&
        alert.metadata?.geofenceId === device.callGeofenceId
    ) {
        return triggerCall(alert);
    }
    await sendPushFCM(alert);
}
module.exports = { dispatch };
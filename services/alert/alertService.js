const Alert = require("../../models/Alert");
const { dispatch } = require("../notification/dispatcher");

async function createAlert(alertData, io) {

  try {

    console.log(
      "📥 createAlert called:",
      alertData
    );

    const now = new Date();

    const DUPLICATE_WINDOWS = {
      ENGINE_ON: 30000,
      ENGINE_OFF: 30000,
      BATTERY_DISCONNECTED: 300000,
      GEOFENCE_ENTER: 60000,
      GEOFENCE_EXIT: 60000,
      OVERSPEED: 15000,
      DEVICE_EXPIRY: 24 * 60 * 60 * 1000,
      OIL_CHANGE_REQUIRED: 24 * 60 * 60 * 1000,
    };

    const DUPLICATE_WINDOW =
      DUPLICATE_WINDOWS[
        alertData.type
      ] || 15000;

    const existing =
      await Alert.findOne({
        deviceId:
          alertData.deviceId,
        type:
          alertData.type,
        timestamp: {
          $gte: new Date(
            Date.now() -
            DUPLICATE_WINDOW
          ),
        },
      });

    if (existing) {

      console.log(
        "⚠️ Duplicate alert skipped:",
        alertData.type
      );

      return null;
    }

    const alertDoc =
      await Alert.create({
        deviceId:
          alertData.deviceId,
        type:
          alertData.type,
        message:
          alertData.message,
        metadata:
          alertData.metadata || {},
        timestamp: now,
        ruleId:
          alertData.ruleId || null,
        priority:
          alertData.priority ||
          "medium",
      });

    console.log(
      "✅ ALERT SAVED:",
      alertDoc
    );

    if (io) {
      await dispatch(
        alertDoc,
        io
      );
    }

    console.log(
      "🚨 ALERT:",
      alertData.type,
      alertData.deviceId
    );

    // Keep latest 50 alerts per device

    const oldAlerts =
      await Alert.find({
        deviceId:
          alertData.deviceId,
      })
        .sort({
          timestamp: -1,
        })
        .skip(50)
        .select("_id");

    if (
      oldAlerts.length > 0
    ) {

      await Alert.deleteMany({
        _id: {
          $in: oldAlerts.map(
            a => a._id
          ),
        },
      });

      console.log(
        `🧹 Deleted ${oldAlerts.length} old alerts for device ${alertData.deviceId}`
      );
    }

    return alertDoc;

  } catch (error) {

    console.error(
      "❌ ALERT CREATION FAILED:",
      error
    );

    return null;
  }
}

module.exports = {
  createAlert,
};
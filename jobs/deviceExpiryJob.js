const Device = require("../models/Device");
const Alert = require("../models/Alert");

const {
  createAlert,
} = require("../services/alert/alertService");

async function runDeviceExpiryCheck(io = null) {

  try {

    console.log(
      "🔍 Running device expiry check..."
    );

    const devices =
      await Device.find({
        isActive: true,
      });

    const today = new Date();

    for (const device of devices) {

      if (!device.expiryDate) {
        continue;
      }

      const daysRemaining =
        Math.ceil(
          (
            new Date(device.expiryDate) -
            today
          ) /
          (1000 * 60 * 60 * 24)
        );

      const triggerDays = [
        30,
        15,
        7,
        0,
      ];

      const alertDay =
        daysRemaining <= 0
          ? 0
          : daysRemaining;

      if (
        !triggerDays.includes(
          alertDay
        )
      ) {
        continue;
      }

      // =====================
      // PREVENT DUPLICATES
      // =====================

      const existing =
        await Alert.findOne({
          deviceId: String(
            device.traccarId
          ),
          type: "DEVICE_EXPIRY",
          read: false,
        });

      if (existing) {
        continue;
      }

      // =====================
      // CREATE ALERT
      // =====================

      await createAlert(
        {
          deviceId: String(
            device.traccarId
          ),

          type: "DEVICE_EXPIRY",

          message:
            daysRemaining <= 0
              ? `${device.name} subscription expired`
              : `${device.name} expires in ${daysRemaining} days`,

          metadata: {
            expiryDate:
              device.expiryDate,

            daysRemaining,
          },

          priority: "high",
        },
        io
      );

      console.log(
        `⚠️ Expiry alert created for ${device.name}`
      );
    }

  } catch (err) {

    console.error(
      "❌ Device expiry job error:",
      err.message
    );
  }
}

module.exports = {
  runDeviceExpiryCheck,
};
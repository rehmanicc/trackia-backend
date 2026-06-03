const Device = require("../models/Device");
const Position = require("../models/Position");
const Alert = require("../models/Alert");

const {
  createAlert,
} = require("../services/alert/alertService");

async function runOilChangeCheck(io = null) {

  try {

    console.log(
      "🛢 Running oil change check..."
    );

    const devices =
      await Device.find({
        isActive: true,
      });

    for (const device of devices) {

      // Skip invalid settings

      if (
        !device.oilChangeLimit ||
        device.oilChangeLimit <= 0
      ) {
        continue;
      }

      const latestPosition =
        await Position.findOne({
          deviceId: device.traccarId,
        })
          .sort({
            deviceTime: -1,
          })
          .select(
            "attributes.odometer"
          );

      const odometer =
        Number(
          latestPosition?.attributes?.odometer
        ) || 0;

      const nextOilChange =
        Number(
          device.oilChangeReading || 0
        ) +
        Number(
          device.oilChangeLimit || 0
        );

      if (
        odometer < nextOilChange
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
          type:
            "OIL_CHANGE_REQUIRED",
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

          type:
            "OIL_CHANGE_REQUIRED",

          message:
            `${device.name} oil change required`,

          metadata: {
            odometer,
            oilChangeReading:
              device.oilChangeReading,
            oilChangeLimit:
              device.oilChangeLimit,
            nextOilChange,
          },

          priority: "medium",
        },
        io
      );

      console.log(
        `🛢 Oil change alert created for ${device.name}`
      );
    }

  } catch (err) {

    console.error(
      "❌ Oil change job error:",
      err.message
    );
  }
}

module.exports = {
  runOilChangeCheck,
};
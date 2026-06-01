
const Device = require("../../models/Device");
const vehicleState = {};
const deviceCache = {};
const {
  formatAlertMessage,
} = require("./alertFormatter");

const ALERT_PRIORITY = {

  // Critical Alerts
  GEOFENCE_EXIT: "high",
  BATTERY_DISCONNECTED: "high",
  DEVICE_EXPIRY: "high",

  // Normal Alerts
  GEOFENCE_ENTER: "medium",
  OVERSPEED: "medium",
  OIL_CHANGE_REQUIRED: "medium",

  ENGINE_ON: "low",
  ENGINE_OFF: "low",
};

async function detectAlerts(position) {

  const alerts = [];

  const {
    deviceId,
    speed = 0,
    attributes = {},
  } = position;

  // ✅ INIT STATE
  if (!vehicleState[deviceId]) {
    vehicleState[deviceId] = {
      engineOn: false,
      batteryConnected: true,
    };
  }

  const state = vehicleState[deviceId];

  // ================= DEVICE =================


  let speedLimit = 70;

  let device = deviceCache[deviceId];

  if (!device) {

    device = await Device.findOne({
      traccarId: deviceId,
    }).lean();

    if (device) {
      deviceCache[deviceId] = device;
    }
  }

  const vehicleLabel =
    device;

  if (device?.speedLimit) {
    speedLimit = device.speedLimit;
  }

  // ================= IGNITION =================

  const ignition =
    attributes?.ignition === true ||
    attributes?.ignition === 1 ||
    attributes?.ignition === "1";

  // ENGINE ON
  if (ignition && !state.engineOn) {

    alerts.push({
      type: "ENGINE_ON",
      message: formatAlertMessage(
        "ENGINE_ON",
        vehicleLabel
      ),
    });

    state.engineOn = true;
  }

  // ENGINE OFF
  if (!ignition && state.engineOn) {

    alerts.push({
      type: "ENGINE_OFF",
      message: formatAlertMessage(
        "ENGINE_OFF",
        vehicleLabel
      ),
    });

    state.engineOn = false;
  }

  // ================= BATTERY =================

  const batteryLevel =
    Number(attributes?.batteryLevel);

  const externalPower =
    Number(attributes?.power);

  const batteryDisconnected =
    batteryLevel === 0 ||
    externalPower === 0;

  // BATTERY DISCONNECTED
  if (
    batteryDisconnected &&
    state.batteryConnected
  ) {

    alerts.push({
      type: "BATTERY_DISCONNECTED",
      message: formatAlertMessage(
        "BATTERY_DISCONNECTED",
        vehicleLabel
      ),
      metadata: {
        batteryLevel,
        externalPower,
      },
    });

    state.batteryConnected = false;
  }

  // BATTERY RESTORED
  if (
    batteryLevel > 0 ||
    externalPower > 0
  ) {
    state.batteryConnected = true;
  }

  // ================= OVERSPEED =================

  const speedKmh = speed * 1.852;

  if (!state.lastOverspeedTime) {
    state.lastOverspeedTime = 0;
  }

  const COOLDOWN = 15000;

  if (speedKmh > speedLimit) {

    const now = Date.now();

    if (
      now - state.lastOverspeedTime >
      COOLDOWN
    ) {

      alerts.push({
        type: "OVERSPEED",
        message: formatAlertMessage(
          "OVERSPEED",
          vehicleLabel,
          {
            speed: Math.round(speedKmh),
          }
        ),
        metadata: {
          speed: Math.round(speedKmh),
          limit: speedLimit,
        },
      });

      state.lastOverspeedTime = now;
    }
  }

  alerts.forEach((a) => {
    a.priority =
      ALERT_PRIORITY[a.type] || "medium";
  });

  return alerts;
}

module.exports = { detectAlerts };
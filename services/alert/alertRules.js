// 🔥 In-memory state (per device)
const vehicleState = {};

const ALERT_PRIORITY = {
  OVERSPEED: "high",
  GEOFENCE_EXIT: "high",
  BATTERY_DISCONNECTED: "high",

  GEOFENCE_ENTER: "medium",

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

  const Device = require("../../models/Device");

  let speedLimit = 70;

  const device = await Device.findOne({
    traccarId: deviceId,
  });

  const vehicleName =
    device?.registrationNumber ||
    device?.name ||
    `Vehicle ${deviceId}`;

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
      message: `${vehicleName} Engine ON`,
    });

    state.engineOn = true;
  }

  // ENGINE OFF
  if (!ignition && state.engineOn) {

    alerts.push({
      type: "ENGINE_OFF",
      message: `${vehicleName} Engine OFF`,
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
      message:
        `${vehicleName} Battery Disconnected`,
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
        message:
          `${vehicleName} Overspeed (${Math.round(speedKmh)} km/h)`,
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
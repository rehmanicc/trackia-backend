const OWNER_ALERTS = [
  "GEOFENCE_EXIT",
  "BATTERY_DISCONNECTED",
  "DEVICE_EXPIRY",
];

function canReceiveAlert(user, alertType) {

  // OWNER

  if (user.role === "owner") {
    return OWNER_ALERTS.includes(alertType);
  }

  // ADMIN

  if (user.role === "admin") {
    return true;
  }

  // USER

  if (user.role === "user") {
    return true;
  }

  return false;
}

module.exports = {
  canReceiveAlert,
};
function getVehicleLabel(device) {

  const registration =
    device?.registrationNumber;

  const name =
    device?.name;

  if (name && registration) {
    return `[${name} | ${registration}]`;
  }

  return (
    registration ||
    name ||
    `Device ${device?.traccarId || "Unknown"}`
  );
}

function formatAlertMessage(
  type,
  device,
  metadata = {}
) {

  const vehicle =
    getVehicleLabel(device);

  switch (type) {

    case "ENGINE_ON":
      return `${vehicle} Ignition ON`;

    case "ENGINE_OFF":
      return `${vehicle} Ignition OFF`;

    case "BATTERY_DISCONNECTED":
      return `${vehicle} Battery Disconnected`;

    case "GEOFENCE_ENTER":
      return `${vehicle} Entered Geofence`;

    case "GEOFENCE_EXIT":
      return `${vehicle} Exited Geofence`;

    case "OVERSPEED":
      return `${vehicle} Overspeed ${metadata.speed} km/h`;

    default:
      return `${vehicle} Alert`;
  }
}

module.exports = {
  formatAlertMessage,
  getVehicleLabel,
};
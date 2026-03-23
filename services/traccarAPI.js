const Position = require("../models/Position");
const Trip = require("../models/Trip");

exports.detectTrips = async (deviceId) => {

  const positions = await Position.find({ deviceId })
    .sort({ timestamp: 1 });

  let tripStart = null;

  for (let pos of positions) {

    const speed = (pos.speed || 0) * 1.852; // knots → km/h

    // START TRIP
    if (speed > 5 && !tripStart) {
      tripStart = pos;
    }

    // END TRIP (use threshold instead of exact 0)
    if (speed < 3 && tripStart) {

      const tripEnd = pos;

      const duration = (tripEnd.timestamp - tripStart.timestamp) / 1000;

      // Avoid very short false trips
      if (duration > 60) { // > 1 minute

        await Trip.create({
          deviceId: deviceId,

          startTime: tripStart.timestamp,
          endTime: tripEnd.timestamp,

          startLat: tripStart.latitude,
          startLng: tripStart.longitude,

          endLat: tripEnd.latitude,
          endLng: tripEnd.longitude,

          duration: duration
        });

      }

      tripStart = null;
    }
  }
};
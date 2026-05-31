const Position = require("../models/Position");
const Device = require("../models/Device");
const { getPositions, apiGet, apiPost } = require("../services/traccarAPI");
const { processPosition } = require("../services/geofenceEngine");
const { handleAlerts } = require("../services/alert/alertProcessor");
const TrackerModel = require("../models/TrackerModel");
const { resolveEngineCommand } = require("../services/commandResolver");

function hasDevicePermission(
  device,
  userId,
  permission
) {
  const p =
    device.devicePermissions?.find(
      p =>
        String(p.userId) ===
        String(userId)
    );

  return p?.[permission] === true;
}
function getDistanceMeters(
  lat1,
  lon1,
  lat2,
  lon2
) {
  const R = 6371000;

  const dLat =
    (lat2 - lat1) *
    Math.PI / 180;

  const dLon =
    (lon2 - lon1) *
    Math.PI / 180;

  const a =
    Math.sin(dLat / 2) *
    Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  return (
    R *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )
  );
}
//Get positions API
exports.getPositions = async (req, res) => {
  try {
    const positions = await getPositions();

    const socket = require("../socket");
    const io = socket.getIO();

    // 🔥 PRELOAD DEVICES (OPTIMIZED)
    const deviceIds = positions.map(p => p.deviceId);
    const devices = await Device.find({ traccarId: { $in: deviceIds } });
    const deviceMap = {};
    devices.forEach(d => {
      deviceMap[d.traccarId] = d;
    });

    const activePositions = [];

    // ======================
    // PROCESS POSITIONS
    // ======================
    for (const p of positions) {

      const device = deviceMap[p.deviceId];

      if (!device) continue;

      // 🔥 EXPIRY CHECK
      if (!device.isActive || new Date() > new Date(device.expiryDate)) {
        console.log(`⛔ Device ${device.traccarId} expired — skipped`);
        continue;
      }

      const lat = Number(p.latitude);
      const lng = Number(p.longitude);

      // ❌ HARD FILTER BEFORE SAVE
      const isValid =
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 && lat <= 90 &&
        lng >= -180 && lng <= 180 &&
        !(lat === 0 && lng === 0);

      if (!isValid) {
        console.log("❌ SKIPPED INVALID (SAVE):", {
          rawLat: p.latitude,
          rawLng: p.longitude,
          parsedLat: lat,
          parsedLng: lng,
          deviceTime: p.deviceTime
        });
        continue; // 🔥 DO NOT SAVE BAD DATA
      }

      const result = await Position.updateOne(
        {
          positionId: p.id
        },
        {
          $setOnInsert: {

            deviceId: p.deviceId,

            latitude: lat,

            longitude: lng,

            speed:
              Number(p.speed) || 0,

            course:
              Number(p.course) || 0,

            attributes:
              p.attributes || {},

            deviceTime:
              p.deviceTime
          }
        },
        { upsert: true }
      );

      const isNew =
        result.upsertedCount > 0;
      if (io && isNew) {
        await processPosition({
          deviceId: p.deviceId,
          latitude: lat,
          longitude: lng,
          speed: Number(p.speed) || 0,
          attributes: p.attributes || {},
          deviceTime: p.deviceTime
        }, io);

        await handleAlerts(p, io);
        activePositions.push({
          ...p,
          engineOn: p.attributes?.ignition === true,

          name: device?.name || null,
          registrationNumber: device?.registrationNumber || null,
        });
      }


    }
    if (io && activePositions.length > 0) {
      io.emit("positions", activePositions);
    }

    console.log("📡 ACTIVE POSITIONS:", activePositions.length);

    res.json(activePositions);

  } catch (error) {
    console.error("Traccar error:", error.message);
    res.status(500).json({ error: error.message });
  }
};
//get routs
exports.getRoute = async (req, res) => {
  try {

    let { deviceId, from, to } = req.query;

    // 🔥 ADD BUFFER (10 minutes)
    const bufferMs = 10 * 60 * 1000;
    to = new Date(new Date(to).getTime() + bufferMs).toISOString();

    const data = await apiGet("/api/reports/route", {
      params: { deviceId, from, to }
    });

    res.json(data);

  } catch (error) {

    console.log("ROUTE ERROR:", error.message);

    if (error.response) {
      console.log(error.response.data);
    }

    res.status(500).json({
      error: error.message
    });

  }
};
//Get Trips
exports.getTrips = async (req, res) => {
  try {

    const { deviceId, from, to } = req.query;

    const data = await apiGet("/api/reports/trips", {
      params: { deviceId, from, to }
    });

    res.json(data);

  } catch (error) {

    console.log("TRIPS ERROR:", error.message);

    if (error.response) {
      console.log(error.response.data);
    }

    res.status(500).json({
      error: error.message
    });

  }
};

// SEND COMMAND
exports.sendCommand = async (req, res) => {
  try {

    const { deviceId, type } = req.body;

    if (!deviceId || !type) {
      return res.status(400).json({
        error: "deviceId and type are required"
      });
    }

    const device =
      await Device.findOne({
        traccarId: deviceId
      });

    if (!device) {
      return res.status(404).json({
        error: "Device not found"
      });
    }

    // Admin ownership validation

    if (
      req.user.role === "admin" &&
      String(device.adminId) !==
      String(req.user.id)
    ) {
      return res.status(403).json({
        error: "Access denied"
      });
    }

    // User assignment validation

    if (
      req.user.role === "user" &&
      !device.assignedUsers.some(
        u =>
          String(u) ===
          String(req.user.id)
      )
    ) {
      return res.status(403).json({
        error:
          "Device not assigned to user"
      });
    }

    const isAuthority =
      req.user.role === "owner" ||
      req.user.role === "admin";

    // General command permission

    if (
      !isAuthority &&
      !req.user.permissions?.includes(
        "SEND_COMMAND"
      )
    ) {
      return res.status(403).json({
        error:
          "No command permission"
      });
    }

    let payload = {
      deviceId,
      type
    };

    const ENGINE_COMMANDS = [
      "engineStop",
      "engineResume"
    ];

    if (
      ENGINE_COMMANDS.includes(type)
    ) {

      const hasEngineAccess =
        hasDevicePermission(
          device,
          req.user.id,
          "engineControl"
        );

      if (
        !isAuthority &&
        !hasEngineAccess
      ) {
        return res.status(403).json({
          error:
            "No engine control permission"
        });
      }

      // Authority lock protection

      if (
        type === "engineResume" &&
        device.engineLockedByAuthority &&
        !isAuthority
      ) {
        return res.status(403).json({
          error:
            "Engine locked by admin"
        });
      }

      // Admin / Platform Owner stop

      if (
        type === "engineStop" &&
        isAuthority
      ) {

        device.engineLockedByAuthority =
          true;

        device.engineLockedBy =
          req.user.id;

        device.engineLastAction =
          "stop";

        device.engineLastActionBy =
          req.user.id;

        await device.save();
      }

      // Admin / Platform Owner resume

      if (
        type === "engineResume" &&
        isAuthority
      ) {

        device.engineLockedByAuthority =
          false;

        device.engineLockedBy =
          null;

        device.engineLastAction =
          "resume";

        device.engineLastActionBy =
          req.user.id;

        await device.save();
      }

      // Vehicle owner / engine user audit

      if (
        type === "engineStop" &&
        !isAuthority
      ) {

        device.engineLastAction =
          "stop";

        device.engineLastActionBy =
          req.user.id;

        await device.save();
      }

      if (
        type === "engineResume" &&
        !isAuthority
      ) {

        device.engineLastAction =
          "resume";

        device.engineLastActionBy =
          req.user.id;

        await device.save();
      }

      const trackerModel =
        await TrackerModel.findById(
          device.trackerModelId
        );

      const resolved =
        resolveEngineCommand(
          trackerModel,
          type === "engineStop"
            ? "stop"
            : "resume"
        );

      payload = {
        deviceId,
        type: resolved.type,
        attributes:
          resolved.attributes
      };
    }

    const data =
      await apiPost(
        "/api/commands/send",
        payload
      );

    res.json(data);

  } catch (error) {

    res.status(500).json({
      error: error.message
    });

  }
};
exports.getHistory = async (req, res) => {

  try {

    const { deviceId, from, to } = req.query;

    if (!deviceId || !from || !to) {

      return res.status(400).json({
        error: "deviceId, from, to required"
      });
    }

    const positions = await Position.find({
      deviceId: Number(deviceId),
      deviceTime: {
        $gte: new Date(from),
        $lte: new Date(to)
      }
    }).sort({ deviceTime: 1 });

    const cleaned = [];

    for (const p of positions) {

      const previous =
        cleaned[cleaned.length - 1];

      if (!previous) {
        cleaned.push(p);
        continue;
      }

      // =====================
      // REMOVE EXACT DUPLICATES
      // =====================

      const sameCoordinate =
        Math.abs(
          previous.latitude -
          p.latitude
        ) < 0.000001 &&
        Math.abs(
          previous.longitude -
          p.longitude
        ) < 0.000001;

      if (sameCoordinate) {
        continue;
      }

      // =====================
      // REMOVE GPS JITTER
      // =====================

      const distance =
        getDistanceMeters(
          previous.latitude,
          previous.longitude,
          p.latitude,
          p.longitude
        );

      if (distance < 5) {
        continue;
      }

      cleaned.push(p);
    }

    console.log(
      `📊 Playback Cleanup: ${positions.length} → ${cleaned.length}`
    );

    res.json(cleaned);

  } catch (err) {

    console.log(
      "❌ HISTORY ERROR:",
      err.message
    );

    res.status(500).json({
      error: err.message
    });
  }
};
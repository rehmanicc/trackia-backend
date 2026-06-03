const express = require("express");
const router = express.Router();

const Alert = require("../models/Alert");
const Device = require("../models/Device");

const auth = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/checkPermission");

const PERMISSIONS = require("../config/permissions");

async function getAccessibleDevices(user) {

  if (user.role === "admin") {

    return Device.find({
      adminId: user.id
    });

  }

  if (user.role === "user") {

    return Device.find({
      assignedUsers: user.id
    });

  }

  return null;
}

// ============================================
// GET ALERTS
// ============================================

router.get("/", auth, async (req, res) => {

  try {

    const { deviceId, type, from, to } =
      req.query;

    const devices =
      await getAccessibleDevices(
        req.user
      );

    if (!devices) {
      return res.json([]);
    }

    const deviceIds =
      devices.map(
        d => String(d.traccarId)
      );

    const query = {};

    if (deviceId) {

      if (
        !deviceIds.includes(
          String(deviceId)
        )
      ) {
        return res.json([]);
      }

      query.deviceId = deviceId;

    } else {

      query.deviceId = {
        $in: deviceIds
      };
    }

    if (type) {
      query.type = type;
    }

    if (from || to) {

      query.timestamp = {};

      if (from) {
        query.timestamp.$gte =
          new Date(from);
      }

      if (to) {
        query.timestamp.$lte =
          new Date(to);
      }
    }

    const alerts =
      await Alert.find(query)
        .sort({
          timestamp: -1
        })
        .limit(50);

    res.json(alerts);

  } catch (err) {

    console.error(
      "❌ Alerts error:",
      err
    );

    res.status(500).json({
      error:
        "Failed to fetch alerts"
    });
  }
});

// ============================================
// MARK ALERT AS READ
// ============================================

router.put(
  "/:id/read",
  auth,
  checkPermission(
    PERMISSIONS.MANAGE_ALERTS
  ),
  async (req, res) => {

    try {

      const devices =
        await getAccessibleDevices(
          req.user
        );

      if (!devices) {
        return res.status(403).json({
          error:
            "Permission denied"
        });
      }

      const deviceIds =
        devices.map(
          d => String(d.traccarId)
        );

      const alert =
        await Alert.findOneAndUpdate(
          {
            _id: req.params.id,
            deviceId: {
              $in: deviceIds
            }
          },
          {
            read: true
          },
          {
            new: true
          }
        );

      if (!alert) {

        return res.status(404).json({
          error:
            "Alert not found"
        });
      }

      res.json(alert);

    } catch (err) {

      res.status(500).json({
        error: err.message
      });
    }
  }
);

// ============================================
// MARK ALL ALERTS AS READ
// ============================================

router.put(
  "/read-all",
  auth,
  checkPermission(
    PERMISSIONS.MANAGE_ALERTS
  ),
  async (req, res) => {

    try {

      const devices =
        await getAccessibleDevices(
          req.user
        );

      if (!devices) {
        return res.status(403).json({
          error:
            "Permission denied"
        });
      }

      const deviceIds =
        devices.map(
          d => String(d.traccarId)
        );

      await Alert.updateMany(
        {
          deviceId: {
            $in: deviceIds
          },
          read: false
        },
        {
          read: true
        }
      );

      res.json({
        message:
          "All alerts marked as read"
      });

    } catch (err) {

      res.status(500).json({
        error: err.message
      });
    }
  }
);

// ============================================
// CLEAR ALERTS
// ============================================

router.delete(
  "/clear",
  auth,
  checkPermission(
    PERMISSIONS.MANAGE_ALERTS
  ),
  async (req, res) => {

    try {

      const devices =
        await getAccessibleDevices(
          req.user
        );

      if (!devices) {
        return res.status(403).json({
          error:
            "Permission denied"
        });
      }

      const deviceIds =
        devices.map(
          d => String(d.traccarId)
        );

      await Alert.deleteMany({
        deviceId: {
          $in: deviceIds
        }
      });

      res.json({
        message:
          "All alerts cleared"
      });

    } catch (err) {

      res.status(500).json({
        error: err.message
      });
    }
  }
);

module.exports = router;
const express = require("express");

const router = express.Router();

const auth =
  require("../middleware/authMiddleware");

const User =
  require("../models/User");

// GET PREFERENCES
router.get(
  "/",
  auth,
  async (req, res) => {

    try {

      const user =
        await User.findById(
          req.user.id
        ).select(
          "alertPreferences"
        );

      res.json(
        user.alertPreferences || {}
      );

    } catch (err) {

      res.status(500).json({
        error: err.message,
      });
    }
  }
);

// UPDATE SINGLE PREFERENCE
router.put(
  "/",
  auth,
  async (req, res) => {

    try {

      const {
        type,
        enabled,
      } = req.body;

      const allowedTypes = [
        "ENGINE_ON",
        "ENGINE_OFF",
        "BATTERY_DISCONNECTED",
        "GEOFENCE_ENTER",
        "GEOFENCE_EXIT",
        "OVERSPEED",
      ];

      if (
        !allowedTypes.includes(type)
      ) {
        return res.status(400)
          .json({
            error:
              "Invalid alert type",
          });
      }

      await User.findByIdAndUpdate(
        req.user.id,
        {
          $set: {
            [`alertPreferences.${type}`]:
              enabled,
          },
        }
      );

      res.json({
        success: true,
      });

    } catch (err) {

      res.status(500).json({
        error: err.message,
      });
    }
  }
);

module.exports = router;
const express = require("express");

const router = express.Router();

const TrackerModel =
  require("../models/TrackerModel");

const auth =
  require("../middleware/authMiddleware");

const PERMISSIONS =
  require("../config/permissions");

// GET ALL TRACKER MODELS
router.get(
  "/",
  auth,
  async (req, res) => {

    try {

      const models =
        await TrackerModel.find()
          .sort({
            createdAt: -1
          });

      res.json(models);

    } catch (err) {

      console.error(
        "❌ TRACKER GET:",
        err
      );

      res.status(500).json({
        error: err.message
      });
    }
  }
);

// CREATE TRACKER MODEL
router.post(
  "/",
  auth,
  async (req, res) => {

    try {

      // 🔒 ONLY OWNER
      if (
        req.user.role !== "owner" &&
        !req.user.permissions?.includes(
          PERMISSIONS.MANAGE_TRACKER_MODELS
        )
      ) {

        return res.status(403).json({
          error:
            "Not authorized to create tracker models"
        });
      }

      const model =
        await TrackerModel.create(
          req.body
        );

      res.json(model);

    } catch (err) {

      console.error(
        "❌ TRACKER CREATE:",
        err
      );

      res.status(500).json({
        error: err.message
      });
    }
  }
);

// UPDATE TRACKER MODEL
router.put(
  "/:id",
  auth,
  async (req, res) => {

    try {

      // 🔒 ONLY OWNER
      if (
        req.user.role !== "owner" &&
        !req.user.permissions?.includes(
          PERMISSIONS.MANAGE_TRACKER_MODELS
        )
      ) {

        return res.status(403).json({
          error:
            "Not authorized to edit tracker models"
        });
      }
      const tracker =
        await TrackerModel.findById(
          req.params.id
        );

      if (!tracker) {

        return res.status(404).json({
          error:
            "Tracker model not found"
        });
      }

      Object.assign(
        tracker,
        req.body
      );

      await tracker.save();

      res.json({
        message:
          "Tracker model updated",
        tracker
      });

    } catch (err) {

      console.error(
        "❌ TRACKER UPDATE:",
        err
      );

      res.status(500).json({
        error: err.message
      });
    }
  }
);

// DELETE TRACKER MODEL
router.delete(
  "/:id",
  auth,
  async (req, res) => {

    try {

      // 🔒 ONLY OWNER
      if (
        req.user.role !== "owner"
      ) {

        return res.status(403).json({
          error:
            "Only owner can delete tracker models"
        });
      }

      const tracker =
        await TrackerModel.findById(
          req.params.id
        );

      if (!tracker) {

        return res.status(404).json({
          error:
            "Tracker model not found"
        });
      }
      const Device =
        require("../models/Device");

      const usageCount =
        await Device.countDocuments({
          trackerModelId: tracker._id
        });

      if (usageCount > 0) {
        return res.status(400).json({
          error:
            "Tracker model is assigned to devices and cannot be deleted"
        });
      }
      await tracker.deleteOne();

      res.json({
        message:
          "Tracker model deleted"
      });

    } catch (err) {

      console.error(
        "❌ TRACKER DELETE:",
        err
      );

      res.status(500).json({
        error: err.message
      });
    }
  }
);

module.exports = router;
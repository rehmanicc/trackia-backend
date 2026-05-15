const express =
  require("express");

const router =
  express.Router();

const auth =
  require("../middleware/authMiddleware");

const SystemSettings =
  require("../models/SystemSettings");

// ======================
// GET CONTACT INFO
// ======================

router.get(
  "/contact",
  async (req, res) => {

    try {

      let settings =
        await SystemSettings.findOne();

      if (!settings) {

        settings =
          await SystemSettings.create({
            contact: {
              phone:
                "+92 0315 7146991",

              email:
                "support@trackiatech.com",

              website:
                "www.trackiatech.com",

              address:
                "Chungi Wah Wali, Musa road, Jhang Pakistan",
            },
          });
      }

      res.json(
        settings.contact
      );

    } catch (err) {

      res.status(500).json({
        error: err.message,
      });
    }
  }
);

// ======================
// UPDATE CONTACT INFO
// ======================

router.put(
  "/contact",
  auth,
  async (req, res) => {

    try {

      if (
        req.user.role !== "owner" &&
        req.user.role !== "admin"
      ) {
        return res.status(403).json({
          error: "Access denied",
        });
      }

      let settings =
        await SystemSettings.findOne();

      if (!settings) {
        settings =
          new SystemSettings();
      }

      settings.contact = {
        ...settings.contact,
        ...req.body,
      };

      await settings.save();

      res.json({
        success: true,
        contact:
          settings.contact,
      });

    } catch (err) {

      res.status(500).json({
        error: err.message,
      });
    }
  }
);

module.exports = router;
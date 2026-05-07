const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User");

router.post(
  "/save-token",
  authMiddleware,
  async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: "Token required",
        });
      }

      await User.findByIdAndUpdate(
        req.user.id,
        {
          $addToSet: {
            fcmTokens: token,
          },
        }
      );

      res.json({
        success: true,
        message: "Token saved",
      });
    } catch (error) {
      console.log(error);

      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

module.exports = router;
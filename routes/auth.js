const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const SECRET = process.env.JWT_SECRET;

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is missing!");
}

// =====================================================
// REGISTER
// =====================================================

router.post("/register", authMiddleware, async (req, res) => {
  const {
    name,
    phoneNumber,
    password,
    role,
    adminId
  } = req.body;

  try {
    if (!name || !phoneNumber || !password) {
      return res.status(400).json({
        error: "Missing fields"
      });
    }

    const existing = await User.findOne({
      phoneNumber
    });

    if (existing) {
      return res.status(400).json({
        error: "Phone already exists"
      });
    }

    // ==========================================
    // OWNER CREATES ADMIN OR USER
    // ==========================================

    if (req.user.role === "owner") {

      const hash = await bcrypt.hash(password, 10);

      // CREATE ADMIN
      if (role === "admin") {

        const user = new User({
          name,
          phoneNumber,
          password: hash,
          role: "admin",
          adminId: null,
          permissions: []
        });

        await user.save();

        return res.json({
          message: "Admin created",
          user
        });
      }

      // CREATE USER
      if (role === "user") {

        if (!adminId) {
          return res.status(400).json({
            error: "Admin is required"
          });
        }

        const admin = await User.findOne({
          _id: adminId,
          role: "admin"
        });

        if (!admin) {
          return res.status(400).json({
            error: "Invalid admin"
          });
        }

        const user = new User({
          name,
          phoneNumber,
          password: hash,
          role: "user",
          adminId,
          permissions: []
        });

        await user.save();

        return res.json({
          message: "User created",
          user
        });
      }

      return res.status(400).json({
        error: "Invalid role"
      });
    }

    // ==========================================
    // ADMIN CREATES USER
    // ==========================================

    if (req.user.role === "admin") {

      if (
        !req.user.permissions?.includes("MANAGE_USERS")
      ) {
        return res.status(403).json({
          error: "No permission to manage users"
        });
      }

      const hash = await bcrypt.hash(password, 10);

      const user = new User({
        name,
        phoneNumber,
        password: hash,
        role: "user",
        adminId: req.user.id,
        permissions: []
      });

      await user.save();

      return res.json({
        message: "User created",
        user
      });
    }

    return res.status(403).json({
      error: "Access denied"
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err);

    if (err.code === 11000) {
      return res.status(400).json({
        error: "Phone already exists"
      });
    }

    res.status(500).json({
      error: err.message
    });
  }
});

// =====================================================
// LOGIN
// =====================================================

router.post("/login", async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;

    const user = await User.findOne({
      phoneNumber
    });

    if (!user) {
      return res.status(400).json({
        error: "User not found"
      });
    }

    const match = await bcrypt.compare(
      password,
      user.password
    );

    if (!match) {
      return res.status(400).json({
        error: "Invalid password"
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        name: user.name,
        role: user.role,
        adminId: user.adminId || user._id,
        permissions: user.permissions || []
      },
      SECRET,
      {
        expiresIn: "24h"
      }
    );

    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        role: user.role,
        adminId: user.adminId || user._id,
        permissions: user.permissions || []
      }
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);

    res.status(500).json({
      error: err.message
    });
  }
});

// =====================================================
// UPDATE USER PERMISSIONS
// =====================================================

router.put(
  "/permissions/:userId",
  authMiddleware,
  async (req, res) => {
    try {
      const { permissions } = req.body;

      if (!Array.isArray(permissions)) {
        return res.status(400).json({
          error: "permissions must be an array"
        });
      }

      // ------------------------------------------
      // OWNER + ADMIN ONLY
      // ------------------------------------------

      if (
        req.user.role !== "owner" &&
        req.user.role !== "admin"
      ) {
        return res.status(403).json({
          error: "Access denied"
        });
      }

      if (
        req.user.role === "admin" &&
        !req.user.permissions?.includes("MANAGE_USERS")
      ) {
        return res.status(403).json({
          error: "No permission to manage users"
        });
      }

      const user = await User.findById(
        req.params.userId
      );

      if (!user) {
        return res.status(404).json({
          error: "User not found"
        });
      }

      // ------------------------------------------
      // ADMIN CAN ONLY EDIT OWN USERS
      // ------------------------------------------

      if (
        req.user.role === "admin" &&
        (
          user.role === "admin" ||
          String(user.adminId) !== String(req.user.id)
        )
      ) {
        return res.status(403).json({
          error: "Access denied"
        });
      }

      // ------------------------------------------
      // VALID PERMISSIONS
      // ------------------------------------------

      const VALID_PERMISSIONS = [
        "MANAGE_USERS",
        "MANAGE_DEVICES",
        "MANAGE_GEOFENCES",
        "MANAGE_ALERTS",
        "VIEW_DASHBOARD",
        "SEND_COMMANDS",
        "RENEW_DEVICES",
        "MANAGE_TRACKER_MODELS"
      ];

      const invalidPermissions =
        permissions.filter(
          p => !VALID_PERMISSIONS.includes(p)
        );

      if (invalidPermissions.length > 0) {
        return res.status(400).json({
          error: `Invalid permissions: ${invalidPermissions.join(", ")}`
        });
      }

      // ------------------------------------------
      // OWNER ONLY PERMISSIONS
      // ------------------------------------------

      if (
        permissions.includes(
          "RENEW_DEVICES"
        ) &&
        req.user.role !== "owner"
      ) {
        return res.status(403).json({
          error:
            "Only owner can grant RENEW_DEVICES"
        });
      }

      if (
        permissions.includes(
          "MANAGE_TRACKER_MODELS"
        ) &&
        req.user.role !== "owner"
      ) {
        return res.status(403).json({
          error:
            "Only owner can grant MANAGE_TRACKER_MODELS"
        });
      }

      // ------------------------------------------
      // OWNER ONLY -> ADMIN ONLY
      // ------------------------------------------

      if (
        permissions.includes(
          "RENEW_DEVICES"
        ) &&
        user.role !== "admin"
      ) {
        return res.status(403).json({
          error:
            "RENEW_DEVICES can only be assigned to admin"
        });
      }

      if (
        permissions.includes(
          "MANAGE_TRACKER_MODELS"
        ) &&
        user.role !== "admin"
      ) {
        return res.status(403).json({
          error:
            "MANAGE_TRACKER_MODELS can only be assigned to admin"
        });
      }
      if (user.role === "user") {
        const forbiddenPermissions = [
          "MANAGE_USERS",
          "MANAGE_DEVICES",
          "SEND_COMMANDS",
          "RENEW_DEVICES",
          "MANAGE_TRACKER_MODELS"
        ];

        const invalidPermissions = permissions.filter(
          p => forbiddenPermissions.includes(p)
        );

        if (invalidPermissions.length > 0) {
          return res.status(403).json({
            error: `${invalidPermissions.join(", ")} can only be assigned to admins`
          });
        }
      }
      user.permissions = permissions;

      await user.save();

      res.json({
        message: "Permissions updated",
        user
      });

    } catch (err) {
      console.error(
        "UPDATE PERMISSIONS ERROR:",
        err
      );

      res.status(500).json({
        error: err.message
      });
    }
  }
);

module.exports = router;
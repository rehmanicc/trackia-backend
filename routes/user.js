const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User");


// ✅ GET USERS (ROLE BASED)
router.get("/", authMiddleware, async (req, res) => {
  try {
    let users;

    if (req.user.role === "owner") {
      // owner sees all
      users = await User.find().select("-password");
    }
    else if (req.user.role === "admin") {
      // admin sees company users
      users = await User.find({
        adminId: req.user.id
      }).select("-password");
    }
    else {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(users);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get("/alert-settings", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.json(user.alertPreferences || {});

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔔 UPDATE ALERT SETTINGS
router.put("/alert-settings", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    const allowedKeys = [
      "OVERSPEED",
      "GEOFENCE_ENTER",
      "GEOFENCE_EXIT",
      "ENGINE_ON",
      "ENGINE_OFF",
      "BATTERY_DISCONNECTED"
    ];

    const updatedPrefs = { ...user.alertPreferences };

    allowedKeys.forEach(key => {
      if (req.body[key] !== undefined) {
        updatedPrefs[key] = !!req.body[key];
      }
    });

    user.alertPreferences = updatedPrefs;
    await user.save();

    res.json(user.alertPreferences);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // 🔐 SECURITY: admin can only see same company users
    if (
      req.user.role === "admin" &&
      String(user.adminId) !== String(req.user.id)
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(user);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ✅ UPDATE USER
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { name, phoneNumber } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // 🔐 Admin restriction (same company)
    if (
      req.user.role === "admin" &&
      String(user.adminId) !== String(req.user.id)
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    // 🔥 UPDATE FIELDS
    if (name) user.name = name;
    if (phoneNumber) user.phoneNumber = phoneNumber;

    await user.save();

    res.json({
      message: "User updated",
      user
    });

  } catch (err) {
    console.error("❌ UPDATE USER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});
router.put("/transfer/:userId", authMiddleware, async (req, res) => {
  try {
    // 🔐 Only owner allowed
    if (req.user.role !== "owner") {
      return res.status(403).json({ error: "Only owner can transfer users" });
    }

    const { newAdminId } = req.body;
    const mongoose = require("mongoose");

    if (!mongoose.Types.ObjectId.isValid(newAdminId)) {
      return res.status(400).json({ error: "Invalid adminId format" });
    }
    if (!newAdminId) {
      return res.status(400).json({ error: "newAdminId required" });
    }

    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const admin = await User.findOne({
      _id: newAdminId,
      role: "admin"
    });

    if (!admin) {
      return res.status(400).json({ error: "Invalid adminId" });
    }
    if (String(user.adminId) === String(newAdminId)) {
      return res.status(400).json({ error: "User already belongs to this admin" });
    }

    if (user.role !== "user") {
      return res.status(400).json({ error: "Only users can be transferred" });
    }

    // 🔥 STEP 1: Unassign all devices
    const Device = require("../models/Device");

    await Device.updateMany(
      { assignedTo: user._id },
      { assignedTo: null }
    );

    // 🔥 STEP 2: Change admin
    user.adminId = newAdminId;
    await user.save();

    res.json({ message: "User transferred successfully" });

  } catch (err) {
    console.error("TRANSFER USER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // ❌ Prevent deleting owner
    if (user.role === "owner") {
      return res.status(403).json({ error: "Cannot delete owner" });
    }

    // ❌ Admin cannot delete admin
    if (req.user.role === "admin" && user.role === "admin") {
      return res.status(403).json({
        error: "Admins cannot delete admins"
      });
    }

    // ❌ Admin can only delete own users
    if (
      req.user.role === "admin" &&
      String(user.adminId) !== String(req.user.id)
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    // 🔥 Unassign devices before delete
    const Device = require("../models/Device");

    await Device.updateMany(
      { assignedTo: user._id },
      { assignedTo: null }
    );

    await User.findByIdAndDelete(userId);

    res.json({ success: true });

  } catch (err) {
    console.error("❌ DELETE USER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});
router.post("/save-fcm-token", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;

    const user = await User.findById(userId);

    if (!user.fcmTokens) user.fcmTokens = [];

    if (!user.fcmTokens.includes(token)) {
      user.fcmTokens.push(token);
    }

    await user.save();

    console.log("✅ FCM token saved:", token);

    res.json({ message: "Token saved" });

  } catch (err) {
    console.error("❌ Save token error:", err);
    res.status(500).json({ error: "Failed to save token" });
  }
});



module.exports = router;
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
module.exports = router;
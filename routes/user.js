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
        companyId: req.user.companyId
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
      String(user.companyId) !== String(req.user.companyId)
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(user);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;
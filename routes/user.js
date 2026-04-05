const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User");

// GET ALL USERS (ADMIN ONLY)
router.get("/", authMiddleware, async (req, res) => {

  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Access denied" });
  }

  const users = await User.find(
    { companyId: req.user.companyId },
    { name: 1, email: 1, role: 1, permissions: 1 }
  );

  res.json(users);
});

module.exports = router;
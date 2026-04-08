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
// REGISTER
router.post("/register", authMiddleware, async (req, res) => {

  const Company = require("../models/Company");
  const { name, phoneNumber, password, role } = req.body;

  console.log("📥 BODY:", req.body);
  console.log("👤 USER:", req.user);

  try {

    // ✅ VALIDATION FIRST
    if (!name || !phoneNumber || !password) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // ✅ CHECK DUPLICATE
    const existing = await User.findOne({ phoneNumber });
    if (existing) {
      return res.status(400).json({ error: "Phone already exists" });
    }

    // 🔐 OWNER → ADMIN
    if (req.user.role === "owner") {

      if (role !== "admin") {
        return res.status(403).json({ error: "Owner can only create admin" });
      }

      const hash = await bcrypt.hash(password, 10);

      const company = await Company.create({
        name: name + " Company"
      });

      const user = new User({
        name,
        phoneNumber,
        password: hash,
        role: "admin",
        companyId: company._id
      });

      await user.save();

      return res.json({ message: "Admin created", user });
    }

    // 🔐 ADMIN → USER
    if (req.user.role === "admin") {

      const hash = await bcrypt.hash(password, 10);

      const user = new User({
        name,
        phoneNumber,
        password: hash,
        role: "user",
        companyId: req.user.companyId
      });

      await user.save();

      return res.json({ message: "User created", user });
    }

    return res.status(403).json({ error: "Access denied" });

  } catch (err) {
    console.error("❌ REGISTER ERROR FULL:", err);

    if (err.code === 11000) {
      return res.status(400).json({ error: "Phone already exists" });
    }

    res.status(500).json({ error: err.message });
  }
});
// LOGIN
router.post("/login", async (req, res) => {
  const { phoneNumber, password } = req.body;
  const user = await User.findOne({ phoneNumber });

  if (!user) {
    return res.status(400).json({ error: "User not found" });
  }

  const match = await bcrypt.compare(password, user.password);

  if (!match) {
    return res.status(400).json({ error: "Invalid password" });
  }

  const token = jwt.sign(
    {
      id: user._id,
      role: user.role,
      companyId: user.companyId,
      permissions: user.permissions || []
    },
    SECRET,
    { expiresIn: "24h" }
  );

  res.json({ token });

});

router.put("/permissions/:userId", authMiddleware, async (req, res) => {
  const { permissions } = req.body;

  // only admin allowed
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Only admin allowed" });
  }

  const user = await User.findById(req.params.userId);

  if (!user) return res.status(404).json({ error: "User not found" });

  user.permissions = permissions;
  await user.save();

  res.json({ message: "Permissions updated", user });
});
module.exports = router;
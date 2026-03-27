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
  const { name, email, password, role } = req.body;

  try {

    // 🔐 OWNER → can create ADMIN only
    if (req.user.role === "owner") {

      if (role !== "admin") {
        return res.status(403).json({ error: "Owner can only create admin" });
      }

      const hash = await bcrypt.hash(password, 10);

      // ✅ CREATE COMPANY FIRST
      const company = await Company.create({
        name: name + " Company"
      });

      const user = new User({
        name,
        email,
        password: hash,
        role: "admin",
        companyId: company._id
      });

      await user.save();

      return res.json({ message: "Admin created", user });
    }

    // 🔐 ADMIN → can create USER only
    if (req.user.role === "admin") {

      const hash = await bcrypt.hash(password, 10);

      const user = new User({
        name,
        email,
        password: hash,
        role: "user",
        companyId: req.user.companyId
      });

      await user.save();

      return res.json({ message: "User created", user });
    }

    // 🔐 USER → no access
    return res.status(403).json({ error: "Access denied" });

  } catch (err) {
    console.error(err);
    console.error("❌ REGISTER ERROR:", err); // 🔥 FULL ERROR
    res.status(500).json({ error: "Failed to create user" });
  }

});
// LOGIN
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

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
      companyId: user.companyId
    },
    SECRET,
    { expiresIn: "24h" }
  );

  res.json({ token });

});

module.exports = router;
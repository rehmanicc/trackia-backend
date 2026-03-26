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

  const { name, email, password, role, companyId } = req.body;

  // 🔐 Only owner/admin can create users
  if (req.user.role === "user") {
    return res.status(403).json({ error: "Access denied" });
  }

  const hash = await bcrypt.hash(password, 10);

  let finalCompanyId;

  if (req.user.role === "owner") {
    // 👑 Owner assigns company manually
    if (!companyId) {
      return res.status(400).json({ error: "companyId required" });
    }
    finalCompanyId = companyId;
  }

  if (req.user.role === "admin") {
    // 👨‍💼 Admin inherits company automatically
    finalCompanyId = req.user.companyId;
  }

  const user = new User({
    name,
    email,
    password: hash,
    role,
    companyId: finalCompanyId
  });

  await user.save();

  res.json({ message: "User created", user });

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
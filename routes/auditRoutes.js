const router = require("express").Router();
const AuditLog = require("../models/AuditLog");
const auth = require("../middleware/authMiddleware");

router.get("/", auth, async (req, res) => {
  try {
    const { userId, action, from, to, page = 1 } = req.query;

    const query = {};

    if (userId) query.userId = userId;
    if (action) query.action = action;

    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = new Date(from);
      if (to) query.timestamp.$lte = new Date(to);
    }

    const logs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .limit(50)
      .skip((page - 1) * 50);

    res.json(logs);

  } catch (err) {
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

module.exports = router;
const express = require("express");
const router = express.Router();
const AlertRule = require("../models/AlertRule");
const auth = require("../middleware/authMiddleware");
const Alert = require("../models/Alert");

// ✅ GET all rules
router.get("/", async (req, res) => {
    try {
        const rules = await AlertRule.find().sort({ createdAt: -1 });
        res.json(rules);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ✅ CREATE rule
router.post("/", async (req, res) => {
    try {
        const rule = await AlertRule.create(req.body);
        res.json(rule);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ✅ UPDATE rule
router.put("/:id", async (req, res) => {
    try {
        const updated = await AlertRule.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        res.json(updated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ✅ DELETE rule
router.delete("/:id", async (req, res) => {
    try {
        await AlertRule.findByIdAndDelete(req.params.id);
        res.json({ message: "Rule deleted" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.post("/test", auth, async (req, res) => {
  try {
    const alert = await Alert.create({
      deviceId: "TEST_DEVICE",
      type: "OVERSPEED",
      message: "🚨 Test Alert Triggered",
      priority: "high"
    });

    // 🔥 dispatch (IMPORTANT)
    const { dispatch } = require("../services/notification/dispatcher");
    await dispatch(alert, req.app.get("io"));

    res.json({ message: "Test alert sent", alert });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
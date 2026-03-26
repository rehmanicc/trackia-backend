const express = require("express");
const router = express.Router();
const Geofence = require("../models/Geofence");
const authMiddleware = require("../middleware/authMiddleware");

// ======================
// GET USER GEOFENCES
// ======================
router.get("/", authMiddleware, async (req, res) => {

  const geofences = await Geofence.find({ userId: req.user.id });

  res.json(geofences);
});

// ======================
// CREATE GEOFENCE (MAX 3)
// ======================
router.post("/", authMiddleware, async (req, res) => {

  const userId = req.user.id;

  const count = await Geofence.countDocuments({ userId });

  if (count >= 3) {
    return res.status(400).json({
      error: "Maximum 3 geofences allowed"
    });
  }

  const geofence = new Geofence({
    ...req.body,
    userId
  });

  await geofence.save();

  res.json({ success: true, geofence });
});

// ======================
// DELETE GEOFENCE
// ======================
router.delete("/:id", authMiddleware, async (req, res) => {

  await Geofence.deleteOne({
    _id: req.params.id,
    userId: req.user.id
  });

  res.json({ success: true });
});

module.exports = router;
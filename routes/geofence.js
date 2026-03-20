const express = require("express");
const router = express.Router();

let geofences = []; // temporary storage (later we’ll use a database)

// GET all geofences
router.get("/", (req, res) => {
  res.json(geofences);
});

// SAVE new geofence
router.post("/", (req, res) => {
  const geofence = req.body;

  geofence.id = Date.now();
  geofences.push(geofence);

  res.json({ success: true, geofence });
});

module.exports = router;
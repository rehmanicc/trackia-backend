// routes/trips.js
const express = require("express")
const router = express.Router()
const Trip = require("../models/Trip")
const authMiddleware = require("../middleware/authMiddleware")

router.get("/", authMiddleware, async (req, res) => {
  try {
    const trips = await Trip.find()
    res.json(trips)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router  // ✅ Must export the router
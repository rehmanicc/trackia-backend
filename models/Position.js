const mongoose = require("mongoose");

const PositionSchema = new mongoose.Schema({
  deviceId: Number,
  latitude: Number,
  longitude: Number,
  speed: Number,
  deviceTime: Date   // ✅ use real time from Traccar
});

// ❌ REMOVE unique index (VERY IMPORTANT)
// PositionSchema.index({ deviceId: 1, timestamp: 1 }, { unique: true });

module.exports = mongoose.model("Position", PositionSchema);
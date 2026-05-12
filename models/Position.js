const mongoose = require("mongoose");

const PositionSchema = new mongoose.Schema({
  positionId: {
    type: Number,
    unique: true,
    index: true
  },

  deviceId: Number,
  latitude: Number,
  longitude: Number,
  speed: Number,
  deviceTime: Date,
  course: Number
});

PositionSchema.index({
  deviceId: 1,
  deviceTime: -1
});

module.exports =
  mongoose.model("Position", PositionSchema);
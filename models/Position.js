const mongoose = require("mongoose");

const PositionSchema = new mongoose.Schema({

  deviceId: {
    type: Number,
    required: true,
    index: true,
  },

  latitude: {
    type: Number,
    required: true,
  },

  longitude: {
    type: Number,
    required: true,
  },

  speed: {
    type: Number,
    default: 0,
  },

  course: {
    type: Number,
    default: 0,
  },

  attributes: {
    type: Object,
    default: {},
  },

  // ✅ Real GPS timestamp from Traccar
  deviceTime: {
    type: Date,
    required: true,
  },

}, {
  timestamps: true,
});

// ✅ Prevent duplicate position inserts
PositionSchema.index(
  { deviceId: 1, deviceTime: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "Position",
  PositionSchema
);
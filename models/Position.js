const mongoose =
  require("mongoose");

const PositionSchema =
  new mongoose.Schema({

    positionId: {
      type: Number,
      unique: true,
      sparse: true,
      index: true,
    },

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

    // ✅ Real GPS timestamp
    deviceTime: {
      type: Date,
      required: true,
      index: true,
    },

  }, {
    timestamps: true,
  });

// ✅ Fast latest position queries
PositionSchema.index({
  deviceId: 1,
  deviceTime: -1,
});

module.exports =
  mongoose.model(
    "Position",
    PositionSchema
  );
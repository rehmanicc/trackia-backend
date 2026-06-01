const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: [
        "ENGINE_ON",
        "ENGINE_OFF",
        "BATTERY_DISCONNECTED",
        "GEOFENCE_ENTER",
        "GEOFENCE_EXIT",
        "OVERSPEED",

        // Maintenance Alerts
        "DEVICE_EXPIRY",
        "OIL_CHANGE_REQUIRED",
      ],
      required: true,
      index: true,
    },

    message: {
      type: String,
      default: "",
    },

    // Flexible metadata for all alert types
    metadata: {
      type: Object,
      default: {},
    },

    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },

    ruleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AlertRule",
      default: null,
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
      index: true,
    },

    read: {
      type: Boolean,
      default: false,
      index: true,
    },

    acknowledged: {
      type: Boolean,
      default: false,
      index: true,
    },

    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    acknowledgedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// =========================
// INDEXES
// =========================

alertSchema.index({
  deviceId: 1,
  type: 1,
  timestamp: -1,
});

alertSchema.index({
  read: 1,
  priority: 1,
});

module.exports = mongoose.model(
  "Alert",
  alertSchema
);
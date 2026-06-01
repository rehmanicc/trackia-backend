const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({

  name: String,

  phoneNumber: {
    type: String,
    required: true,
    unique: true
  },

  password: String,

  role: {
    type: String,
    enum: ["owner", "admin", "user"],
    default: "user"
  },

  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: function () {
      return this.role === "user";
    },
    index: true
  },

  permissions: {
    type: [String],
    default: []
  },

  // =========================
  // ALERT PREFERENCES
  // =========================

  alertPreferences: {

    ENGINE_ON: {
      type: Boolean,
      default: true,
    },

    ENGINE_OFF: {
      type: Boolean,
      default: true,
    },

    BATTERY_DISCONNECTED: {
      type: Boolean,
      default: true,
    },

    GEOFENCE_ENTER: {
      type: Boolean,
      default: true,
    },

    GEOFENCE_EXIT: {
      type: Boolean,
      default: true,
    },

    OVERSPEED: {
      type: Boolean,
      default: true,
    },

    DEVICE_EXPIRY: {
      type: Boolean,
      default: true,
    },

    OIL_CHANGE_REQUIRED: {
      type: Boolean,
      default: true,
    },
  },

  // =========================
  // CALL SETTINGS
  // =========================

  callEnabled: {
    type: Boolean,
    default: false
  },

  callPriority: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "high"
  },

  // =========================
  // AUDIT
  // =========================

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  // =========================
  // PUSH NOTIFICATIONS
  // =========================

  fcmTokens: {
    type: [String],
    default: []
  }

});

userSchema.index({ role: 1 });

module.exports = mongoose.model(
  "User",
  userSchema
);
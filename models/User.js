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
  alertPreferences: {
    type: Object,
    default: {
      OVERSPEED: true,
      GEOFENCE_ENTER: true,
      GEOFENCE_EXIT: true,
      ENGINE_ON: false,
      ENGINE_OFF: false,
      BATTERY_DISCONNECTED: true
    }
  },
  callEnabled: {
    type: Boolean,
    default: false
  },

  callPriority: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "high"
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  fcmTokens: {
    type: [String],
    default: []
  },
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
},

});
userSchema.index({ role: 1 });

module.exports = mongoose.model("User", userSchema);
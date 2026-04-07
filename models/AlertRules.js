const mongoose = require("mongoose");

const alertRuleSchema = new mongoose.Schema({

    // 🔥 Alert Type (same as existing system)
    type: {
        type: String,
        enum: [
            "ENGINE_ON",
            "ENGINE_OFF",
            "BATTERY_DISCONNECTED",
            "GEOFENCE_ENTER",
            "GEOFENCE_EXIT",
            "OVERSPEED"
        ],
        required: true
    },

    // ✅ Enable / Disable rule
    enabled: {
        type: Boolean,
        default: true
    },

    // 🎯 Conditions (only what you need now)
    conditions: {
        speedLimit: Number
    },

    // 🎯 Apply rule to specific devices
    deviceIds: [{
        type: String
    }],

    // ⏱ Cooldown (override default)
    cooldown: {
        type: Number,
        default: 15000
    },

    // 🔥 Priority (for next steps)
    priority: {
        type: String,
        enum: ["low", "medium", "high"],
        default: "medium"
    }

}, { timestamps: true });


// 🔥 PERFORMANCE INDEX (important for scaling)
alertRuleSchema.index({ type: 1, deviceIds: 1 });


module.exports = mongoose.model("AlertRule", alertRuleSchema);
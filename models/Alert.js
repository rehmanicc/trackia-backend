const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema({

    deviceId: {
        type: String,
        required: true,
        index: true
    },

    type: {
        type: String,
        enum: [
            "ENGINE_ON",
            "ENGINE_OFF",
            "BATTERY_DISCONNECTED",
            "GEOFENCE_ENTER",
            "GEOFENCE_EXIT"
        ],
        required: true,
        index: true
    },

    message: {
        type: String
    },

    metadata: {
        geofenceId: String,
        batteryLevel: Number
    },

    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }

}, { timestamps: true });

/**
 * 🚀 IMPORTANT:
 * Helps prevent duplicate alerts
 */
alertSchema.index({
    deviceId: 1,
    type: 1,
    timestamp: 1
});

module.exports = mongoose.model("Alert", alertSchema);
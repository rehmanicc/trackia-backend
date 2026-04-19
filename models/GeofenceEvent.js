const mongoose = require("mongoose");

const geofenceEventSchema = new mongoose.Schema({
    deviceId: {
        type: String,
        required: true,
        index: true
    },

    geofenceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Geofence",
        required: true,
        index: true
    },

    type: {
        type: String,
        enum: ["ENTER", "EXIT"],
        required: true
    },

    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },

    // Optional but VERY useful for future analytics
    position: {
        lat: Number,
        lng: Number
    }

}, { timestamps: true });

/**
 * 🚀 Prevent duplicate events (IMPORTANT)
 * One event per device + geofence + type within short time
 */
geofenceEventSchema.index({
    deviceId: 1,
    geofenceId: 1,
    type: 1,
    timestamp: 1
});

module.exports = mongoose.model("GeofenceEvent", geofenceEventSchema);
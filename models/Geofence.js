const mongoose = require("mongoose");

const geofenceSchema = new mongoose.Schema({
    name: String,
    type: String,
    geometry: Object,

    userId: mongoose.Schema.Types.ObjectId,

    deviceId: String,

    createdByRole: {
        type: String,
        enum: ["user", "admin"],
        default: "user"
    }

}, { timestamps: true });

module.exports = mongoose.model("Geofence", geofenceSchema);
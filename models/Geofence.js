const mongoose = require("mongoose");

const geofenceSchema = new mongoose.Schema({
    type: Object,
    userId: mongoose.Schema.Types.ObjectId,
    deviceId: Number
}, { timestamps: true });

module.exports = mongoose.model("Geofence", geofenceSchema);
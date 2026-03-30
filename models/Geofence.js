const mongoose = require("mongoose");

const geofenceSchema = new mongoose.Schema({
    name: String, // ✅ ADD THIS
    type: String, // ✅ FIX TYPE
    geometry: Object, // ✅ ADD THIS
    userId: mongoose.Schema.Types.ObjectId,
    deviceId: Number
}, { timestamps: true });

module.exports = mongoose.model("Geofence", geofenceSchema);
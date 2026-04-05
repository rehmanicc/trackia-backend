const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema({

    name: String,
    uniqueId: String,

    traccarId: {
        type: Number,
        required: true
    },

    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company"
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    speedLimit: {
        type: Number,
        default: 70
    },
    fuelEfficiency: {
        type: Number,
        default: 12
    },
    assignedTo: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }]

}, { timestamps: true });

module.exports = mongoose.model("Device", deviceSchema);
const mongoose = require("mongoose");

const trackerModelSchema =
new mongoose.Schema({

    name: {
        type: String,
        required: true,
        unique: true
    },

    brand: {
        type: String,
        required: true
    },

    protocol: {
        type: String,
        default: "custom"
    },

    supportsEngineControl: {
        type: Boolean,
        default: false
    },

    engineStopCommand: {
        type: String,
        default: ""
    },

    engineResumeCommand: {
        type: String,
        default: ""
    },

    notes: {
        type: String,
        default: ""
    }

}, { timestamps: true });

module.exports =
mongoose.model(
    "TrackerModel",
    trackerModelSchema
);
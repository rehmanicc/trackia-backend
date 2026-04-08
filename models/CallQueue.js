const mongoose = require("mongoose");

const callQueueSchema = new mongoose.Schema({

    number: String,
    alertType: String,
    deviceId: String,

    status: {
        type: String,
        enum: ["pending", "processing", "done", "failed"],
        default: "pending"
    },

    attempts: {
        type: Number,
        default: 0
    },

    nextRetryAt: {
        type: Date,
        default: Date.now
    }

}, { timestamps: true });

callQueueSchema.index({ status: 1, nextRetryAt: 1 });

module.exports = mongoose.model("CallQueue", callQueueSchema);
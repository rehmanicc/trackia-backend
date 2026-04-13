const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema({

    name: String,
    uniqueId: {
        type: String,
        index: true
    },

    traccarId: {
        type: Number,
        required: true
    },

    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
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
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
        index: true
    },
    expiryDate: {
        type: Date,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    engineControlEnabled: {
        type: Boolean,
        default: false
    },
    traccarId: {
        type: Number,
        required: true
    }

}, { timestamps: true });
deviceSchema.index({ adminId: 1 });
deviceSchema.index({ assignedTo: 1 });
deviceSchema.index({ traccarId: 1 });
deviceSchema.pre("save", async function (next) {
    if (this.assignedTo) {
        const user = await mongoose.model("User").findById(this.assignedTo);

        if (!user) {
            return next(new Error("Assigned user not found"));
        }

        if (String(user.adminId) !== String(this.adminId)) {
            return next(new Error("User and Device admin mismatch"));
        }
    }
    next();
});
module.exports = mongoose.model("Device", deviceSchema);
const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true
    },
    uniqueId: {
        type: String,
        unique: true,
        required: true,
        index: true
    },

    traccarId: {
        type: Number,
        required: true,
        unique: true,
        index: true
    },
    registrationNumber: {
        type: String,
        default: ""
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
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
        default: null
    },
    expiryDate: {
        type: Date,
        required: true
    },
    callUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },

    callGeofenceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Geofence",
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    },
    engineControlEnabled: {
        type: Boolean,
        default: false
    },
    engineLockedByAdmin: {
        type: Boolean,
        default: false,
        index: true
    },
    engineLockedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    callEnabled: {
        type: Boolean,
        default: true
    },

    assignedUsers: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    ],
    deviceSimNumber: {
        type: String,
        required: true,
        unique: true
    },
    callReceiverNumber: {
        type: String,
        required: true
    },

    allowUserToChangeCallReceiver: {
        type: Boolean,
        default: false
    }

}, { timestamps: true });
deviceSchema.index({ adminId: 1 });
deviceSchema.index({ assignedUsers: 1 });
deviceSchema.pre("save", async function () {

    if (!this.isModified("assignedUsers")) return;

    if (!this.assignedUsers || this.assignedUsers.length === 0) return;
    const User = mongoose.model("User");
    for (const userId of this.assignedUsers) {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error("Assigned user not found");
        }

        if (user.role !== "user") {
            throw new Error("Device can only be assigned to a user");
        }

        if (String(user.adminId) !== String(this.adminId)) {
            throw new Error("User and Device admin mismatch");
        }
    }
});

module.exports = mongoose.model("Device", deviceSchema);
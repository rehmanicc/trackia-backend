const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    uniqueId: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },

    traccarId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },

    trackerModelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TrackerModel",
      default: null,
    },

    registrationNumber: {
      type: String,
      default: "",
    },

    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // =========================
    // VEHICLE SETTINGS
    // =========================

    speedLimit: {
      type: Number,
      default: 70,
    },

    fuelEfficiency: {
      type: Number,
      default: 12,
    },

    oilChangeLimit: {
      type: Number,
      default: 3000,
    },

    oilChangeReading: {
      type: Number,
      default: 0,
    },

    expiryDate: {
      type: Date,
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // =========================
    // VEHICLE OWNER
    // =========================

    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // =========================
    // GEOFENCE
    // =========================

    callGeofenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Geofence",
      default: null,
    },

    // =========================
    // ASSIGNED USERS
    // =========================

    assignedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // =========================
    // DEVICE LEVEL PERMISSIONS
    // =========================

    devicePermissions: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },

        engineControl: {
          type: Boolean,
          default: false,
        },
        editSpeedLimit: {
          type: Boolean,
          default: false,
        },
        editCallNumber: {
          type: Boolean,
          default: false,
        },
        editFuelAverage: {
          type: Boolean,
          default: false,
        },

        editOilChangeReading: {
          type: Boolean,
          default: false,
        },

        editOilChangeLimit: {
          type: Boolean,
          default: false,
        },
      },
    ],

    // =========================
    // ENGINE SECURITY
    // =========================

    engineLockedByAuthority: {
      type: Boolean,
      default: false,
      index: true,
    },

    engineLockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    engineLastAction: {
      type: String,
      enum: ["stop", "resume", null],
      default: null,
    },

    engineLastActionBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // =========================
    // COMMUNICATION
    // =========================

    deviceSimNumber: {
      type: String,
      unique: true,
      sparse: true,
    },

    callReceiverNumber: {
      type: String,
      default: null,
    },

    callEnabled: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// =========================
// INDEXES
// =========================

deviceSchema.index({ adminId: 1 });
deviceSchema.index({ assignedUsers: 1 });
deviceSchema.index({ ownerUserId: 1 });

// =========================
// VALIDATION
// =========================

deviceSchema.pre("save", async function () {

  const User = mongoose.model("User");

  if (this.assignedUsers?.length) {

    for (const userId of this.assignedUsers) {

      const user = await User.findById(userId);

      if (!user) {
        throw new Error("Assigned user not found");
      }

      if (user.role !== "user") {
        throw new Error(
          "Device can only be assigned to users"
        );
      }

      if (
        String(user.adminId) !==
        String(this.adminId)
      ) {
        throw new Error(
          "User and Device admin mismatch"
        );
      }
    }
  }
  if (this.ownerUserId) {

    const owner = await User.findById(
      this.ownerUserId
    );

    if (!owner) {
      throw new Error(
        "Vehicle owner not found"
      );
    }

    if (owner.role !== "user") {
      throw new Error(
        "Vehicle owner must be a user"
      );
    }

    if (
      String(owner.adminId) !==
      String(this.adminId)
    ) {
      throw new Error(
        "Vehicle owner admin mismatch"
      );
    }
  }
  for (const permission of this.devicePermissions || []) {

    const assigned =
      (this.assignedUsers || []).some(
        id =>
          String(id) ===
          String(permission.userId)
      );

    if (!assigned) {
      throw new Error(
        "Device permissions user must be assigned to device"
      );
    }
  }
});

module.exports = mongoose.model(
  "Device",
  deviceSchema
);
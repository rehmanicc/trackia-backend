const Device = require("../models/Device");
const traccarAPI = require("../services/traccarAPI");
const Geofence = require("../models/Geofence");
const User = require("../models/User");
const mongoose = require("mongoose");
const Position = require("../models/Position");

exports.createDevice = async (req, res, next) => {

  const {
    name,
    uniqueId,
    speedLimit,
    fuelEfficiency,
    oilChangeLimit,
    oilChangeReading,
    registrationNumber,
    trackerModelId,
    deviceSimNumber,
    callReceiverNumber
  } = req.body;

  const user = req.user;

  try {

    const { logAudit } = require("../services/auditService");

    if (user.role === "owner" && !req.body.adminId) {
      return res.status(400).json({
        error: "adminId is required when owner creates device"
      });
    }

    if (user.role === "owner") {
      const adminExists = await User.findOne({
        _id: req.body.adminId,
        role: "admin"
      });

      if (!adminExists) {
        return res.status(400).json({
          error: "Invalid adminId"
        });
      }
    }

    const existingMongo = await Device.findOne({ uniqueId });
    if (trackerModelId) {

      const TrackerModel =
        require("../models/TrackerModel");

      const trackerModel =
        await TrackerModel.findById(
          trackerModelId
        );

      if (!trackerModel) {

        return res.status(400).json({
          error:
            "Invalid tracker model"
        });
      }
    }
    if (existingMongo) {
      return res.status(400).json({
        error: "Device already exists in system"
      });
    }

    const traccarDevices = await traccarAPI.apiGet("/api/devices");

    let traccarDevice = traccarDevices.find(d => d.uniqueId === uniqueId);

    if (!traccarDevice) {
      traccarDevice = await traccarAPI.apiPost("/api/devices", {
        name,
        uniqueId
      });
    }

    const oneYearLater = new Date();
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

    const device = await Device.create({

      name,

      uniqueId,

      traccarId: traccarDevice.id,

      registrationNumber,

      trackerModelId,

      adminId:
        user.role === "admin"
          ? user.id
          : new mongoose.Types.ObjectId(
            req.body.adminId
          ),

      createdBy: user.id,

      assignedUsers: [],

      speedLimit: speedLimit || 70,

      fuelEfficiency: fuelEfficiency || 12,

      oilChangeLimit: oilChangeLimit || 3000,

      oilChangeReading: oilChangeReading || 0,

      expiryDate: oneYearLater,

      deviceSimNumber: deviceSimNumber || null,

      callReceiverNumber: callReceiverNumber || null,

      isActive: true
    });

    // 🔥 AUDIT LOG (ADD HERE)
    try {
      await logAudit({
        userId: user.id,
        action: "CREATE_DEVICE",
        entity: "Device",
        entityId: device._id,
        metadata: {
          name,
          uniqueId,
          adminId: device.adminId
        }
      });
    } catch (e) {
      console.error("Audit failed:", e);
    }

    res.json(device);

  } catch (err) {
    console.error("❌ DEVICE ERROR:", err.response?.data || err.message);

    return res.status(500).json({
      error: err.response?.data?.message || err.message
    });
  }
};
exports.updateDevice = async (req, res) => {
  try {
    const device = await Device.findById(req.params.id);

    if (!device) {
      return res.status(404).json({
        error: "Device not found"
      });
    }

    const isOwner = req.user.role === "owner";

    const isAdmin =
      req.user.role === "admin" &&
      String(device.adminId) === String(req.user.id);

    const isUser = req.user.role === "user";

    // ==================================================
    // USER MUST BE ASSIGNED
    // ==================================================

    if (isUser) {
      const assigned = device.assignedUsers.some(
        id => String(id) === String(req.user.id)
      );

      if (!assigned) {
        return res.status(403).json({
          error: "Device not assigned"
        });
      }
    }

    // ==================================================
    // NO ACCESS
    // ==================================================

    if (!isOwner && !isAdmin && !isUser) {
      return res.status(403).json({
        error: "Access denied"
      });
    }

    const {
      name,
      registrationNumber,
      deviceSimNumber,
      trackerModelId,
      adminId,

      speedLimit,
      fuelEfficiency,
      oilChangeReading,
      oilChangeLimit,
      callReceiverNumber
    } = req.body;

    // ==================================================
    // OWNER / ADMIN FULL ACCESS
    // ==================================================

    if (isOwner || isAdmin) {

      if (name !== undefined) {
        device.name = name;
      }

      if (registrationNumber !== undefined) {
        device.registrationNumber = registrationNumber;
      }

      if (deviceSimNumber !== undefined) {
        device.deviceSimNumber = deviceSimNumber;
      }

      if (speedLimit !== undefined) {
        device.speedLimit = Number(speedLimit);
      }

      if (fuelEfficiency !== undefined) {
        device.fuelEfficiency = Number(fuelEfficiency);
      }

      if (oilChangeReading !== undefined) {
        device.oilChangeReading = Number(oilChangeReading);
      }

      if (oilChangeLimit !== undefined) {
        device.oilChangeLimit = Number(oilChangeLimit);
      }

      if (callReceiverNumber !== undefined) {
        device.callReceiverNumber = callReceiverNumber;
      }

      if (trackerModelId !== undefined) {
        const TrackerModel = require("../models/TrackerModel");

        const trackerExists =
          await TrackerModel.findById(trackerModelId);

        if (!trackerExists) {
          return res.status(400).json({
            error: "Invalid tracker model"
          });
        }

        device.trackerModelId = trackerModelId;
      }

      if (isOwner && adminId) {

        const admin = await User.findOne({
          _id: adminId,
          role: "admin"
        });

        if (!admin) {
          return res.status(400).json({
            error: "Invalid adminId"
          });
        }

        device.adminId = adminId;
      }

      await device.save();

      return res.json({
        message: "Device updated successfully",
        device
      });
    }

    // ==================================================
    // USER DEVICE PERMISSIONS
    // ==================================================

    const permission =
      device.devicePermissions?.find(
        p => String(p.userId) === String(req.user.id)
      );

    if (!permission) {
      return res.status(403).json({
        error: "No device permissions found"
      });
    }

    let updated = false;

    if (
      speedLimit !== undefined &&
      permission.editSpeedLimit
    ) {
      device.speedLimit = Number(speedLimit);
      updated = true;
    }

    if (
      fuelEfficiency !== undefined &&
      permission.editFuelAverage
    ) {
      device.fuelEfficiency = Number(fuelEfficiency);
      updated = true;
    }

    if (
      oilChangeReading !== undefined &&
      permission.editOilChangeReading
    ) {
      device.oilChangeReading = Number(oilChangeReading);
      updated = true;
    }

    if (
      oilChangeLimit !== undefined &&
      permission.editOilChangeLimit
    ) {
      device.oilChangeLimit = Number(oilChangeLimit);
      updated = true;
    }

    if (
      callReceiverNumber !== undefined &&
      permission.editCallNumber
    ) {
      device.callReceiverNumber = callReceiverNumber;
      updated = true;
    }

    if (!updated) {
      return res.status(403).json({
        error: "No permission to edit requested fields"
      });
    }

    await device.save();

    res.json({
      message: "Device updated successfully",
      device
    });

  } catch (err) {
    console.error("UPDATE DEVICE ERROR:", err);

    res.status(500).json({
      error: err.message
    });
  }
};
exports.getDevices = async (req, res) => {
  try {
    const user = req.user;

    let devices;

    if (user.role === "owner") {

      devices = await Device.find()

        .populate(
          "assignedUsers",
          "name phoneNumber"
        )

        .populate(
          "ownerUserId",
          "name phoneNumber"
        )

        .populate(
          "devicePermissions.userId",
          "name phoneNumber"
        )

        .populate("trackerModelId");

    }
    else if (user.role === "admin") {

      const mongoose = require("mongoose");

      devices = await Device.find({
        adminId:
          new mongoose.Types.ObjectId(
            user.id
          )
      })

        .populate(
          "assignedUsers",
          "name phoneNumber"
        )

        .populate(
          "ownerUserId",
          "name phoneNumber"
        )

        .populate(
          "devicePermissions.userId",
          "name phoneNumber"
        )

        .populate("trackerModelId");

    }
    else {

      devices = await Device.find({
        assignedUsers: user.id
      })

        .populate(
          "assignedUsers",
          "name phoneNumber"
        )

        .populate(
          "ownerUserId",
          "name phoneNumber"
        )

        .populate(
          "devicePermissions.userId",
          "name phoneNumber"
        )

        .populate("trackerModelId");

    }

    const latestPositions =
      await Position.aggregate([

        {
          $match: {
            deviceId: {
              $in: devices.map(
                d => d.traccarId
              )
            }
          }
        },

        {
          $sort: {
            deviceTime: -1
          }
        },

        {
          $group: {
            _id: "$deviceId",
            latest: {
              $first: "$$ROOT"
            }
          }
        }
      ]);

    const merged = devices.map(d => {

      const latest =
        latestPositions.find(
          p => p._id === d.traccarId
        )?.latest;

      const isOnline =
        latest &&
        (
          Date.now() -
          new Date(latest.deviceTime)
        ) < 120000;

      return {

        ...d._doc,

        online: isOnline,

        position: latest
          ? {
            speed:
              latest.speed || 0,

            latitude:
              latest.latitude,

            longitude:
              latest.longitude,

            course:
              latest.course || 0,

            deviceTime:
              latest.deviceTime,

            attributes:
              latest.attributes || {},
          }
          : null,
      };
    });

    res.json(merged);

  } catch (err) {
    console.error("❌ getDevices error:", err.message);
    res.status(500).json({ error: err.message });
  }
};
// DELETE DEVICE
exports.deleteDevice = async (req, res) => {
  try {
    const { logAudit } = require("../services/auditService");

    const device = await Device.findById(req.params.id);

    if (!device) return res.status(404).json({ error: "Not found" });

    if (
      req.user.role !== "owner" &&
      (
        req.user.role !== "admin" ||
        String(device.adminId) !== String(req.user.id)
      )
    ) {
      return res.status(403).json({
        error: "Access denied"
      });
    }
    const deviceData = {
      name: device.name,
      uniqueId: device.uniqueId,
      traccarId: device.traccarId,
      adminId: device.adminId
    };

    await traccarAPI.apiDelete(`/api/devices/${device.traccarId}`);
    await Geofence.deleteMany({
      deviceId: device.traccarId
    });


    await device.deleteOne();


    try {
      await logAudit({
        userId: req.user.id,
        action: "DELETE_DEVICE",
        entity: "Device",
        entityId: device._id,
        metadata: deviceData
      });
    } catch (e) {
      console.error("Audit failed:", e);
    }

    res.json({ message: "Device deleted" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
// ASSIGN DEVICE
exports.assignDevice = async (req, res) => {
  try {
    const mongoose = require("mongoose");
    const { logAudit } = require("../services/auditService");

    const { userId } = req.body;
    const deviceId = req.params.id;

    console.log("📥 Device ID:", deviceId);
    console.log("📥 Assign Body:", req.body);

    // ✅ VALIDATION
    if (!mongoose.Types.ObjectId.isValid(deviceId)) {
      return res.status(400).json({ error: "Invalid deviceId" });
    }

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid userId" });
    }

    const device = await Device.findById(deviceId);
    const user = await User.findById(userId);

    if (!device || !user) {
      return res.status(404).json({ error: "Not found" });
    }

    if (
      String(device.adminId) !==
      String(user.adminId)
    ) {
      return res.status(400).json({
        error:
          "User and device belong to different admins"
      });
    }

    // 🔒 Admin ownership validation
    if (
      req.user.role !== "owner" &&
      (
        req.user.role !== "admin" ||
        String(device.adminId) !== String(req.user.id)
      )
    ) {
      return res.status(403).json({
        error: "Access denied"
      });
    }

    if (
      !device.assignedUsers.some(
        id =>
          String(id) === String(userId)
      )
    ) {

      device.assignedUsers.push(userId);

      device.devicePermissions.push({

        userId,
        engineControl: false,
        editSpeedLimit: false,
        editFuelAverage: false,
        editOilChangeReading: false,
        editOilChangeLimit: false,
        editCallNumber: false,

      });
    }

    await device.save();

    // 🔥 AUDIT LOG (ADD HERE)
    try {
      await logAudit({
        userId: req.user.id,
        action: "ASSIGN_DEVICE",
        entity: "Device",
        entityId: device._id,
        metadata: {
          assignedTo: userId
        }
      });
    } catch (e) {
      console.error("Audit failed:", e);
    }

    res.json({
      message: "Device assigned successfully",
      assignedUsers: device.assignedUsers
    });

  } catch (err) {
    console.error("❌ ASSIGN ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};
// UNASSIGN DEVICE
exports.unassignDevice = async (req, res) => {
  try {
    const { logAudit } = require("../services/auditService"); // 🔥 add

    const device = await Device.findById(req.params.id);

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    if (
      req.user.role !== "owner" &&
      (
        req.user.role !== "admin" ||
        String(device.adminId) !== String(req.user.id)
      )
    ) {
      return res.status(403).json({
        error: "Access denied"
      });
    }
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }

    if (
      !device.assignedUsers.some(
        id =>
          String(id) === String(userId)
      )
    ) {
      return res.json({
        message: "User already unassigned"
      });
    }

    console.log("🔄 Unassigning device:", device._id);

    const previousUser = userId; // 🔥 capture before removing

    device.assignedUsers = device.assignedUsers.filter(
      id => String(id) !== String(req.body.userId)
    );
    device.devicePermissions =
      device.devicePermissions.filter(
        p =>
          String(p.userId) !==
          String(userId)
      );
    if (
      device.ownerUserId &&
      String(device.ownerUserId) ===
      String(userId)
    ) {
      device.ownerUserId = null;
    }
    await device.save();

    // 🔥 AUDIT LOG
    try {
      await logAudit({
        userId: req.user.id,
        action: "UNASSIGN_DEVICE",
        entity: "Device",
        entityId: device._id,
        metadata: {
          previousAssignedTo: previousUser
        }
      });
    } catch (e) {
      console.error("Audit failed:", e);
    }

    res.json({ message: "Device unassigned successfully" });

  } catch (err) {
    console.error("❌ UNASSIGN ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateDevicePermissions = async (req, res) => {
  try {

    const device = await Device.findById(
      req.params.id
    );

    if (!device) {
      return res.status(404).json({
        error: "Device not found"
      });
    }

    // OWNER OR DEVICE ADMIN ONLY

    if (
      req.user.role !== "owner" &&
      (
        req.user.role !== "admin" ||
        String(device.adminId) !== String(req.user.id)
      )
    ) {
      return res.status(403).json({
        error: "Access denied"
      });
    }

    const {
      ownerUserId,
      permissions
    } = req.body;

    // OWNER USER MUST BE ASSIGNED
    if (ownerUserId) {

      const ownerUser = await User.findById(
        ownerUserId
      );

      if (!ownerUser) {
        return res.status(400).json({
          error: "Vehicle owner not found"
        });
      }

      if (ownerUser.role !== "user") {
        return res.status(400).json({
          error: "Vehicle owner must be a user"
        });
      }

      if (
        String(ownerUser.adminId) !==
        String(device.adminId)
      ) {
        return res.status(400).json({
          error: "Vehicle owner admin mismatch"
        });
      }
    }
    device.ownerUserId =
      ownerUserId || null;

    if (permissions) {

      const normalized = permissions || [];
      const assignedIds =
        device.assignedUsers.map(id =>
          String(id?._id || id)
        );

      for (const p of normalized) {

        const permissionUserId =
          String(
            p.userId?._id || p.userId
          );

        if (
          !assignedIds.includes(
            permissionUserId
          )
        ) {
          return res.status(400).json({
            error:
              "Permission user must be assigned to device"
          });
        }
      }
      device.devicePermissions =
        normalized;
    }

    await device.save();

    res.json({
      message:
        "Device permissions updated",
      device
    });

  } catch (err) {

    console.error(
      "❌ DEVICE PERMISSION ERROR:",
      err
    );

    res.status(500).json({
      error: err.message
    });
  }
};
const Device = require("../models/Device");
const traccarAPI = require("../services/traccarAPI");
const Geofence = require("../models/Geofence");
const User = require("../models/User");
const mongoose = require("mongoose");
const Position =
  require("../models/Position");

exports.createDevice = async (req, res, next) => {

  const { name, uniqueId, speedLimit, fuelEfficiency, registrationNumber } = req.body;
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
      adminId:
        user.role === "admin"
          ? user.id
          : new mongoose.Types.ObjectId(req.body.adminId),
      createdBy: user.id,
      assignedUsers: [],
      speedLimit: speedLimit || 70,
      fuelEfficiency: fuelEfficiency || 12,
      expiryDate: oneYearLater,
      deviceSimNumber: req.body.deviceSimNumber,
      callReceiverNumber: req.body.callReceiverNumber || null,

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
exports.updateDevice = async (
  req,
  res
) => {

  try {

    const device =
      await Device.findById(
        req.params.id
      );

    if (!device) {
      return res.status(404).json({
        error: "Device not found"
      });
    }

    // 🔒 ADMIN OWNERSHIP CHECK
    if (
      req.user.role === "admin" &&
      String(device.adminId) !==
      String(req.user.id)
    ) {
      return res.status(403).json({
        error: "Access denied"
      });
    }

    const {
      name,
      registrationNumber,
      deviceSimNumber,
      callReceiverNumber,
      speedLimit,
      fuelEfficiency,
      oilChangeReading,
      adminId,
    } = req.body;

    // 🔐 PERMISSIONS

    const canEditTrackerSim =
      req.user.role === "owner" ||
      req.user.role === "admin";

    const canEditSpeed =
      req.user.permissions?.includes(
        "EDIT_SPEED"
      );

    const canEditFuel =
      req.user.permissions?.includes(
        "EDIT_FUEL"
      );

    const canEditOil =
      req.user.permissions?.includes(
        "EDIT_OIL"
      );

    const canEditCall =
      req.user.permissions?.includes(
        "EDIT_CALL_NUMBER"
      );

    // ✅ FULL ACCESS
    if (canEditTrackerSim) {

      if (name !== undefined) {
        device.name = name;
      }

      if (
        registrationNumber !== undefined
      ) {
        device.registrationNumber =
          registrationNumber;
      }

      if (
        deviceSimNumber !== undefined
      ) {
        device.deviceSimNumber =
          deviceSimNumber;
      }

      if (
        callReceiverNumber !== undefined
      ) {
        device.callReceiverNumber =
          callReceiverNumber;
      }
    }

    // ✅ PERMISSION BASED
    if (
      canEditSpeed &&
      speedLimit !== undefined
    ) {
      device.speedLimit =
        speedLimit;
    }

    if (
      canEditFuel &&
      fuelEfficiency !== undefined
    ) {
      device.fuelEfficiency =
        fuelEfficiency;
    }

    if (
      canEditOil &&
      oilChangeReading !== undefined
    ) {
      device.oilChangeReading =
        oilChangeReading;
    }

    // 👑 OWNER ONLY
    if (
      req.user.role === "owner" &&
      adminId
    ) {
      device.adminId = adminId;
    }

    await device.save();

    res.json({
      message:
        "Device updated successfully",
      device
    });

  } catch (err) {

    console.error(
      "❌ UPDATE DEVICE ERROR:",
      err
    );

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
      // 👑 Owner → ALL devices
      devices = await Device.find()
        .populate("assignedUsers", "name")
        .populate("trackerModelId");
    }
    else if (user.role === "admin") {
      // 🧑‍💼 Admin → own company devices
      const mongoose = require("mongoose");

      devices = await Device.find({
        adminId: new mongoose.Types.ObjectId(user.id)
      })
        .populate("assignedUsers", "name")
        .populate("trackerModelId");
    }
    else {
      // 👤 User → only assigned devices
      devices = await Device.find({
        assignedUsers: user.id
      })
        .populate("assignedUsers", "name")
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
      req.user.role === "admin" &&
      String(device.adminId) !== String(req.user.id)
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
      req.user.role === "admin" &&
      String(device.adminId) !==
      String(req.user.id)
    ) {
      return res.status(403).json({
        error: "Access denied"
      });
    }

    if (
      req.user.role === "admin" &&
      String(device.adminId) !== String(req.user.id)
    ) {
      return res.status(403).json({
        error: "Not allowed to assign this device"
      });
    }

    if (!device.assignedUsers.includes(userId)) {
      device.assignedUsers.push(userId);
    }


    if (!device.callReceiverNumber) {
      device.callReceiverNumber = user.phoneNumber;
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
      req.user.role === "admin" &&
      String(device.adminId) !==
      String(req.user.id)
    ) {
      return res.status(403).json({
        error: "Access denied"
      });
    }
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }

    if (!device.assignedUsers.includes(userId)) {
      return res.json({ message: "User already unassigned" });
    }

    console.log("🔄 Unassigning device:", device._id);

    const previousUser = userId; // 🔥 capture before removing

    device.assignedUsers = device.assignedUsers.filter(
      id => String(id) !== String(req.body.userId)
    );

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
exports.toggleEngineAccess = async (req, res) => {
  try {
    const device = await Device.findById(req.params.id);

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    device.engineControlEnabled = !device.engineControlEnabled;

    await device.save();

    res.json({
      message: "Engine control updated",
      engineControlEnabled: device.engineControlEnabled
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
exports.updateDevicePermissions = async (req, res) => {
  try {
    const device = await Device.findById(req.params.id);

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    // 🔒 ONLY OWNER / ADMIN
    // 🔐 PERMISSION CHECK (REPLACE ROLE CHECK)
    if (
      req.user.role !== "owner" &&
      !req.user.permissions?.includes("MANAGE_DEVICE_PERMISSIONS")
    ) {
      return res.status(403).json({
        error: "No permission to update device permissions"
      });
    }

    // 🔒 OWNERSHIP CHECK
    if (
      req.user.role === "admin" &&
      String(device.adminId) !== String(req.user.id)
    ) {
      return res.status(403).json({
        error: "Not allowed to modify this device"
      });
    }

    const {
      engineControlEnabled,
      allowUserToChangeCallReceiver
    } = req.body;

    // ✅ update only provided fields
    if (typeof engineControlEnabled === "boolean") {
      device.engineControlEnabled = engineControlEnabled;
    }

    if (typeof allowUserToChangeCallReceiver === "boolean") {
      device.allowUserToChangeCallReceiver =
        allowUserToChangeCallReceiver;
    }

    await device.save();

    res.json({
      message: "Device permissions updated",
      device
    });

  } catch (err) {
    console.error("❌ DEVICE PERMISSION ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};
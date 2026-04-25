const Device = require("../models/Device");
const traccarAPI = require("../services/traccarAPI");
const Geofence = require("../models/Geofence");
const User = require("../models/User");
const mongoose = require("mongoose");
// CREATE DEVICE


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
          ? user._id
          : new mongoose.Types.ObjectId(req.body.adminId),
      createdBy: user._id,
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
        userId: user._id,
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
exports.getDevices = async (req, res) => {
  try {
    const user = req.user;

    let devices;

    if (user.role === "owner") {
      // 👑 Owner → ALL devices
      devices = await Device.find()
        .populate("assignedUsers", "name"); // ✅ FIXED
    }
    else if (user.role === "admin") {
      // 🧑‍💼 Admin → own company devices
      devices = await Device.find({ adminId: user._id })
        .populate("assignedUsers", "name"); // ✅ FIXED
    }
    else {
      // 👤 User → only assigned devices
      devices = await Device.find({
        assignedUsers: user._id
      }).populate("assignedUsers", "name");
    }

    // 🔥 GET LIVE DEVICES FROM TRACCAR
    const traccarDevices = await traccarAPI.apiGet("/api/devices");

    // 🔥 MERGE STATUS
    const merged = devices.map(d => {
      const live = traccarDevices.find(t => t.id === d.traccarId);

      return {
        ...d._doc,
        status: live?.status || "offline",
        lastUpdate: live?.lastUpdate || null
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

    // 🔥 Capture data BEFORE delete (important)
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
        userId: req.user._id,
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

    const { userId, callUserId } = req.body;
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

    if (String(device.adminId) !== String(user.adminId)) {
      return res.status(400).json({
        error: "User and device belong to different admins"
      });
    }

    if (
      req.user.role === "admin" &&
      String(device.adminId) !== String(req.user._id)
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
        userId: req.user._id,
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
        userId: req.user._id,
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
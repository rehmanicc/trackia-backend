const Device = require("../models/Device");
const traccarAPI = require("../services/traccarAPI");
const Geofence = require("../models/Geofence");
const User = require("../models/User");

// CREATE DEVICE


exports.createDevice = async (req, res, next) => {

  const { name, uniqueId, speedLimit, fuelEfficiency } = req.body;
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

    const traccarRes = await traccarAPI.get("/api/devices");
    const traccarDevices = traccarRes.data;

    let traccarDevice = traccarDevices.find(d => d.uniqueId === uniqueId);

    if (!traccarDevice) {
      const response = await traccarAPI.post("/api/devices", {
        name,
        uniqueId
      });
      traccarDevice = response.data;
    }

    const oneYearLater = new Date();
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

    const device = await Device.create({
      name,
      uniqueId,
      traccarId: traccarDevice.id,
      adminId: user.role === "admin" ? user._id : req.body.adminId,
      createdBy: user._id,
      assignedTo: null,
      speedLimit: speedLimit || 70,
      fuelEfficiency: fuelEfficiency || 12,
      expiryDate: oneYearLater,
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
        .populate("assignedTo", "name");
    }
    else if (user.role === "admin") {
      devices = await Device.find({ adminId: user.id })
        .populate("assignedTo", "name");
    }
    else {

      devices = await Device.find({
        assignedTo: user.id
      }).populate("assignedTo", "name");
    }

    // 🔥 GET LIVE DEVICES FROM TRACCAR
    const traccarRes = await traccarAPI.get("/api/devices");
    const traccarDevices = traccarRes.data;

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

    await traccarAPI.delete(`/api/devices/${device.traccarId}`);

    await Geofence.deleteMany({
      deviceId: device.traccarId
    });

    // 🔥 Delete device
    await device.deleteOne();

    // 🔥 AUDIT LOG (ADD HERE)
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

    if (device.assignedTo) {
      console.log("♻️ Overwriting assignment for device:", device._id);
    }

    if (String(device.adminId) !== String(user.adminId)) {
      return res.status(400).json({
        error: "User and device belong to different admins"
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

    device.assignedTo = userId;
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
      assignedTo: device.assignedTo
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

    if (!device.assignedTo) {
      return res.json({ message: "Already unassigned" });
    }

    console.log("🔄 Unassigning device:", device._id);

    const previousUser = device.assignedTo; // 🔥 capture before removing

    device.assignedTo = null;

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
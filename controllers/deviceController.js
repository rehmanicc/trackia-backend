const Device = require("../models/Device");
const traccarAPI = require("../services/traccarAPI");
const Geofence = require("../models/Geofence");

// CREATE DEVICE


exports.createDevice = async (req, res) => {

  const { name, uniqueId, speedLimit, fuelEfficiency } = req.body;
  const user = req.user;
  
  try {

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

    // ✅ EXPIRY LOGIC (CORRECT PLACE)
    const oneYearLater = new Date();
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

    const device = await Device.create({
      name,
      uniqueId,
      traccarId: traccarDevice.id,
      companyId: user.companyId,
      createdBy: user._id,
      assignedTo: [],
      speedLimit: speedLimit || 70,
      fuelEfficiency: fuelEfficiency || 12,
      expiryDate: oneYearLater,
      isActive: true
    });

    res.json(device);

  } catch (err) {
    console.error("❌ DEVICE ERROR:", err.response?.data || err.message);

    res.status(500).json({
      error: err.response?.data?.message || err.message
    });
  }
};
exports.getDevices = async (req, res) => {
  try {
    const user = req.user;

    let devices;

    if (user.role === "owner" || user.role === "admin") {
      devices = await Device.find({ companyId: user.companyId })
        .populate("assignedTo", "name");
    } else {
      devices = await Device.find({
        assignedTo: user.id,
        companyId: user.companyId
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
    const device = await Device.findById(req.params.id);

    if (!device) return res.status(404).json({ error: "Not found" });
    await traccarAPI.delete(`/api/devices/${device.traccarId}`);

    await Geofence.deleteMany({
      deviceId: device.traccarId
    });

    // 🔥 2. Delete device from Mongo
    await device.deleteOne();
    res.json({ message: "Device deleted" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
// ASSIGN DEVICE
exports.assignDevice = async (req, res) => {
  try {
    const mongoose = require("mongoose");

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

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    
    // ✅ FORCE ARRAY (IMPORTANT)
    if (!Array.isArray(device.assignedTo)) {
      device.assignedTo = [];
    }

    // ✅ CLEAN NULL VALUES
    device.assignedTo = (device.assignedTo || []).filter(u => u);

    // ✅ SAFE DUPLICATE CHECK
    const alreadyAssigned = device.assignedTo.some(
      u => u && u.toString() === userId
    );

    if (alreadyAssigned) {
      return res.status(400).json({
        error: "Device already assigned"
      });
    }

    // ✅ ASSIGN
    device.assignedTo.push(new mongoose.Types.ObjectId(userId));

    await device.save();

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
  const { userId } = req.body;

  const device = await Device.findById(req.params.id);

  device.assignedTo.pull(userId);
  await device.save();

  res.json(device);
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
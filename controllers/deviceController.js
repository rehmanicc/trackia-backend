const Device = require("../models/Device");
const traccarAPI = require("../services/traccarAPI");
const Geofence = require("../models/Geofence");

// CREATE DEVICE
exports.createDevice = async (req, res) => {
  const { name, uniqueId, speedLimit, fuelEfficiency } = req.body;
  const user = req.user;
  if (user.role !== "admin") {
    return res.status(403).json({
      error: "Only admin can create devices"
    });
  }
  try {

    const response = await traccarAPI.post("/api/devices", {
      name,
      uniqueId
    });

    // 2. Save in Mongo
    const device = await Device.create({
      name,
      uniqueId,
      traccarId: response.data.id,
      companyId: user.companyId,
      createdBy: user._id,
      assignedTo: [user._id],
      speedLimit: speedLimit || 70,
      fuelEfficiency: fuelEfficiency || 12
    });

    res.json(device);

  } catch (err) {
    res.status(500).json({ error: err.message });
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

    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Not allowed" });
    }

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
  const { userId } = req.body;

  const device = await Device.findById(req.params.id);

  if (!device) return res.status(404).json({ error: "Not found" });

  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Not allowed" });
  }

  device.assignedTo.addToSet(userId);
  await device.save();

  res.json(device);
};
// UNASSIGN DEVICE
exports.unassignDevice = async (req, res) => {
  const { userId } = req.body;

  const device = await Device.findById(req.params.id);

  device.assignedTo.pull(userId);
  await device.save();

  res.json(device);
};
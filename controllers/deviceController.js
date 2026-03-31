const Device = require("../models/Device");
const axios = require("axios");

// CREATE DEVICE
exports.createDevice = async (req, res) => {
  const { name, uniqueId } = req.body;
  const user = req.user;
  if (user.role !== "admin") {
    return res.status(403).json({
      error: "Only admin can create devices"
    });
  }
  try {

    const response = await axios.post(
      `${process.env.TRACCAR_URL}/api/devices`,
      { name, uniqueId },
      {
        auth: {
          username: process.env.TRACCAR_EMAIL,
          password: process.env.TRACCAR_PASSWORD
        }
      }
    );

    // 2. Save in Mongo
    const device = await Device.create({
      name,
      uniqueId,
      traccarId: response.data.id,
      companyId: user.companyId,
      createdBy: user._id,
      assignedTo: [user._id] // ✅ FIXED ARRAY
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

    if (user.role === "owner") {
      devices = await Device.find({ companyId: user.companyId });
    }
    else if (user.role === "admin") {
      devices = await Device.find({ companyId: user.companyId });
    }
    else {
      devices = await Device.find({
        assignedTo: user.id,
        companyId: user.companyId
      });
    }

    res.json(devices);

  } catch (err) {
    console.error(err);
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

    await axios.delete(
      `${process.env.TRACCAR_URL}/api/devices/${device.traccarId}`,
      {
        auth: {
          username: process.env.TRACCAR_EMAIL,
          password: process.env.TRACCAR_PASSWORD
        }
      }
    );

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
const Device = require("../models/Device");
const axios = require("axios");

// CREATE DEVICE
exports.createDevice = async (req, res) => {
    const { name, uniqueId } = req.body;
    const user = req.user;

    try {
        // 1. Create in Traccar
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
exports.addDevice = async (req, res) => {
  try {
    const { name, uniqueId } = req.body;

    const user = req.user;

    let assignedTo = null;

    // 🔥 ROLE LOGIC
    if (user.role === "admin") {
      assignedTo = user._id; // auto assign to admin
    }

    if (user.role === "user") {
      return res.status(403).json({ error: "Access denied" });
    }

    // 1️⃣ Create in Traccar
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

    // 2️⃣ Save in MongoDB
    const device = await Device.create({
      name,
      uniqueId,
      traccarId: response.data.id,
      companyId: user.companyId, // 🔥 IMPORTANT
      createdBy: user._id,
      assignedTo
    });

    res.json(device);

  } catch (err) {
    console.error(err);
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
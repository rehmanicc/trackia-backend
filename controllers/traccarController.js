const axios = require("axios");
const Position = require("../models/Position");
const TRACCAR_URL = process.env.TRACCAR_URL;
const EMAIL = process.env.TRACCAR_EMAIL;
const PASSWORD = process.env.TRACCAR_PASSWORD;
const traccarAPI = require("../services/traccarAPI");
const socket = require("../socket");

// GET DEVICES
const Device = require("../models/Device");

exports.getDevices = async (req, res) => {
    try {
        const user = req.user;

        let devices;

        if (user.role === "owner") {
            // 👑 Super Admin → all company devices
            devices = await Device.find({ companyId: user.companyId });
        }

        else if (user.role === "admin") {
            // 🧑‍💼 Admin → only his devices
            devices = await Device.find({ assignedTo: user._id });
        }

        else {
            // 👤 User → only assigned devices
            devices = await Device.find({ assignedTo: user._id });
        }

        res.json(devices);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};
//Get positions API

exports.getPositions = async (req, res) => {
  try {
    const response = await axios.get(
      `${process.env.TRACCAR_URL}/api/positions`,
      {
        auth: {
          username: process.env.TRACCAR_EMAIL,
          password: process.env.TRACCAR_PASSWORD,
        },
      }
    );

    const positions = response.data;

    // ✅ 🔥 EMIT TO SOCKET CLIENTS
    const io = require("../socket").getIO();
    io.emit("positions", positions);

    res.json(positions);

  } catch (error) {
    console.error("Traccar error:", error.message);
    res.status(500).json({ error: error.message });
  }
};
//add device

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
//get routs
exports.getRoute = async (req, res) => {
  try {

    const { deviceId, from, to } = req.query;

 const response = await traccarAPI.get("/api/reports/route", {
  params: { deviceId, from, to }
});

    res.json(response.data);

  } catch (error) {

    console.log("ROUTE ERROR:", error.message);

    if (error.response) {
      console.log(error.response.data);
    }

    res.status(500).json({
      error: error.message
    });

  }
};
//Get Trips
exports.getTrips = async (req, res) => {
  try {

    const { deviceId, from, to } = req.query;

    const response = await traccarAPI.get("/api/reports/trips", {
  params: { deviceId, from, to }
});

    res.json(response.data);

  } catch (error) {

    console.log("TRIPS ERROR:", error.message);

    if (error.response) {
      console.log(error.response.data);
    }

    res.status(500).json({
      error: error.message
    });

  }
};
//commands
// SEND COMMAND
exports.sendCommand = async (req, res) => {
  try {
    const { deviceId, type } = req.body;

    // Validate input
    if (!deviceId || !type) {
      return res.status(400).json({
        error: "deviceId and type are required"
      });
    }

    const response = await traccarAPI.post("/api/commands/send", {
      deviceId,
      type
    });

    res.json(response.data);

  } catch (error) {
    console.error("COMMAND ERROR:", error.message);

    if (error.response) {
      console.error("Traccar Response:", error.response.data);
    }

    res.status(500).json({
      error: error.message || "Failed to send command"
    });
  }
};
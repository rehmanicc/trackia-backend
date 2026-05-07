const Device = require("../models/Device");
const traccarAPI = require("../services/traccarAPI");

exports.getDashboardStats = async (req, res) => {
    try {
        const user = req.user;

        let devices = [];

        // OWNER
        if (user.role === "owner") {
            devices = await Device.find();
        }

        // ADMIN
        else if (user.role === "admin") {
            const mongoose = require("mongoose");

            devices = await Device.find({
                adminId: new mongoose.Types.ObjectId(user.id),
            });
        }

        // USER
        else {
            devices = await Device.find({
                assignedUsers: user.id,
            });
        }

        // LIVE STATUS FROM TRACCAR
        const traccarDevices = await traccarAPI.apiGet("/api/devices");

        let movingVehicles = 0;
        let stoppedVehicles = 0;

        // 🔥 GET LIVE POSITIONS
        const positions = await traccarAPI.apiGet("/api/positions");

        devices.forEach((device) => {

            const position = positions.find(
                (p) => p.deviceId === device.traccarId
            );

            // 🔥 SPEED CHECK
            const speed = position?.speed || 0;

            // Traccar speed is knots
            const speedKmh = speed * 1.852;

            if (speedKmh > 4) {
                movingVehicles++;
            } else {
                stoppedVehicles++;
            }
        });

        // EXPIRED
        const expiredVehicles = devices.filter(
            (d) =>
                d.expiryDate &&
                new Date(d.expiryDate) < new Date()
        ).length;

        res.json({
            totalVehicles: devices.length,
            movingVehicles,
            stoppedVehicles,
            expiredVehicles,
        });

    } catch (err) {
        console.error("❌ Dashboard stats error:", err);

        res.status(500).json({
            error: "Dashboard stats failed",
        });
    }
};
const Alert = require("../models/Alert");

exports.getCriticalAlerts = async (req, res) => {
    try {

        const user = req.user;

        let devices = [];

        // OWNER
        if (user.role === "owner") {
            devices = await Device.find();
        }

        // ADMIN
        else if (user.role === "admin") {

            const mongoose = require("mongoose");

            devices = await Device.find({
                adminId: new mongoose.Types.ObjectId(user.id),
            });
        }

        // USER
        else {

            devices = await Device.find({
                assignedUsers: user.id,
            });
        }

        const deviceIds = devices.map(d => String(d.traccarId));

        const alerts = await Alert.find({
            deviceId: { $in: deviceIds },
            type: {
                $in: [
                    "BATTERY_DISCONNECTED",
                    "GEOFENCE_EXIT"
                ]
            }
        })
        .sort({ timestamp: -1 })
        .limit(5);

        // 🔥 attach device info
        const formatted = alerts.map(alert => {

            const device = devices.find(
                d => String(d.traccarId) === String(alert.deviceId)
            );

            return {
                _id: alert._id,
                type: alert.type,
                message: alert.message,
                priority: alert.priority,
                timestamp: alert.timestamp,
                read: alert.read,

                device: device ? {
                    name: device.name,
                    registrationNumber: device.registrationNumber,
                    traccarId: device.traccarId
                } : null
            };
        });

        res.json(formatted);

    } catch (err) {

        console.error("❌ Critical alerts error:", err);

        res.status(500).json({
            error: "Failed to fetch critical alerts"
        });
    }
};
const Device = require("../models/Device");
const Alert = require("../models/Alert");
const Position = require("../models/Position");
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

        else {
            devices = await Device.find({
                assignedUsers: user.id,
            });
        }

        let movingVehicles = 0;
        let stoppedVehicles = 0;

        const latestPositions = await Position.aggregate([

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
        const traccarDevices =
            await traccarAPI.apiGet("/api/devices");
        const positionMap = {};

        latestPositions.forEach(p => {
            positionMap[p._id] = p.latest;
        });

        const traccarMap = {};

        traccarDevices.forEach(d => {
            traccarMap[d.id] = d;
        });
        devices.forEach((device) => {

            const position =
                positionMap[device.traccarId];

            const speed = position?.speed || 0;

            const speedKmh = speed * 1.852;

            const liveDevice =
                traccarMap[device.traccarId];

            if (liveDevice?.status !== "online") {
                stoppedVehicles++;
            }
            else if (speedKmh > 4) {
                movingVehicles++;
            }
            else {
                stoppedVehicles++;
            }
        });
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
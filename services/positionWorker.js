const { getBatch } = require("./positionQueue");
const Position = require("../models/Position");
const Device = require("../models/Device");
const socket = require("../socket");
const { processPosition } = require("./geofenceEngine");
const { handleAlerts } = require("./alert/alertProcessor");

let processedCount = 0;
const lastEmitted = {};
setInterval(() => {
    if (processedCount > 0) {
        console.log("📊 Positions/sec:", processedCount);
        processedCount = 0;
    }
}, 1000);
let isRunning = false;
async function processBatch() {
    try {
        const batch = getBatch(200);

        if (batch.length === 0) return;

        const io = socket.getIO();

        const positions = batch.flat();

        const deviceIds = [...new Set(positions.map(p => p.deviceId))];

        const devices = await Device.find({
            traccarId: { $in: deviceIds }
        });

        const deviceMap = {};
        devices.forEach(d => {
            deviceMap[d.traccarId] = d;
        });

        const bulkOps = [];
        const activePositions = [];

        for (const p of positions) {
            if (!p || !p.deviceId || !p.latitude || !p.longitude || !p.deviceTime) continue;

            const device = deviceMap[p.deviceId];
            if (!device) continue;

            if (!device.isActive || new Date() > new Date(device.expiryDate)) {
                continue;
            }

            bulkOps.push({
                updateOne: {
                    filter: {
                        deviceId: p.deviceId,
                        deviceTime: p.deviceTime
                    },
                    update: {
                        $setOnInsert: {
                            deviceId: p.deviceId,
                            latitude: p.latitude,
                            longitude: p.longitude,
                            speed: p.speed,
                            deviceTime: p.deviceTime
                        }
                    },
                    upsert: true
                }
            });

            activePositions.push({
                deviceId: p.deviceId,
                latitude: p.latitude,
                longitude: p.longitude,
                speed: p.speed,
                course: p.course,
                deviceTime: p.deviceTime,
                engineOn: p.attributes?.ignition === true,
                name: device?.name || null,
                registrationNumber: device?.registrationNumber || null,
            });
            try {

                await processPosition(p, io);

                await handleAlerts(p, io);

            } catch (err) {

                console.error(
                    "❌ Alert/geofence processing failed:",
                    err.message
                );
            }
        }

        if (bulkOps.length > 0) {
            await Position.bulkWrite(bulkOps, { ordered: false });
        }

        if (io && activePositions.length > 0) {

            const userMap = {};

            for (const pos of activePositions) {
                const device = deviceMap[pos.deviceId];
                if (!device) continue;

                if (device.assignedUsers && device.assignedUsers.length > 0) {
                    device.assignedUsers.forEach(u => {
                        const userId = String(u);

                        if (!userMap[userId]) userMap[userId] = [];
                        userMap[userId].push(pos);
                    });
                }

                // emit to company (admin group)
                if (device.adminId) {
                    const adminRoom = `company_${device.adminId}`;
                    io.to(adminRoom).emit("positions", [pos]);

                    // 🔥 ALSO emit to admin as user (CRITICAL FIX)
                    io.to(`user_${device.adminId}`).emit("positions", [pos]);
                    // 🔥 EMIT TO OWNER USERS
                    const User = require("../models/User");

                    const owners = await User.find({
                        role: "owner"
                    }).select("_id");

                    owners.forEach(owner => {
                        io.to(`user_${owner._id}`).emit(
                            "positions",
                            [pos]
                        );
                    });
                }
            }

            if (Math.random() < 0.05) {
                console.log("👥 USER MAP:", Object.keys(userMap).length);
            }

            if (Object.keys(userMap).length === 0) {
                console.log("⚠️ No users mapped — forcing emit");

                io.emit("positions", activePositions); // TEMP DEBUG
            }

            // emit per user
            for (const userId in userMap) {

                const latestPerDevice = {};

                for (const pos of userMap[userId]) {
                    latestPerDevice[pos.deviceId] = pos;
                }

                const filteredPositions = [];

                for (const deviceId in latestPerDevice) {
                    const pos = latestPerDevice[deviceId];

                    if (lastEmitted[deviceId]) {
                        const last = lastEmitted[deviceId];

                        const latDiff = Math.abs(last.latitude - pos.latitude);
                        const lngDiff = Math.abs(last.longitude - pos.longitude);

                        const moved = latDiff > 0.000003 || lngDiff > 0.000003; // 🔥 smaller threshold (~30cm)
                        const speedChanged = last.speed !== pos.speed;
                        const engineChanged = last.engineOn !== pos.engineOn;

                        if (!moved && !speedChanged && !engineChanged) {
                            continue;
                        }
                    }

                    // ✅ store latest emitted
                    lastEmitted[deviceId] = pos;

                    filteredPositions.push(pos);
                }

                if (filteredPositions.length > 0) {
                    try {
                        console.log("🚀 EMIT:", JSON.stringify(filteredPositions));
                        io.to(`user_${userId}`).emit("positions", filteredPositions);
                    } catch (err) {
                        console.log("❌ Emit error:", err.message);
                    }
                }
            }
        }


        // 🔥 reduced logging
        if (Math.random() < 0.2) {
            console.log("⚡ Processed:", activePositions.length);
        }

        processedCount += activePositions.length;

    } catch (err) {
        console.error("❌ Worker error:", err);
    }
}

async function loop() {
    if (isRunning) return;

    isRunning = true;
    await processBatch();
    isRunning = false;
}

setInterval(loop, 500);

module.exports = {};
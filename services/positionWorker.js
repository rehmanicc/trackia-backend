const { getBatch } = require("./positionQueue");
const Position = require("../models/Position");
const Device = require("../models/Device");
const socket = require("../socket");
let processedCount = 0;

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
                engineOn: p.attributes?.ignition === true
            });
        }

        if (bulkOps.length > 0) {
            await Position.bulkWrite(bulkOps, { ordered: false });
        }

        if (io && activePositions.length > 0) {

            const userMap = {};

            for (const pos of activePositions) {
                const device = deviceMap[pos.deviceId];
                if (!device || !device.assignedTo) continue;

                const userId = String(device.assignedTo);

                if (!userMap[userId]) {
                    userMap[userId] = [];
                }

                userMap[userId].push(pos);
            }

            // emit per user
            for (const userId in userMap) {

                const latestPerDevice = {};

                for (const pos of userMap[userId]) {
                    latestPerDevice[pos.deviceId] = pos;
                }

                io.to(`user_${userId}`).emit(
                    "positions",
                    Object.values(latestPerDevice)
                );
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

setInterval(loop, 200);

module.exports = {};
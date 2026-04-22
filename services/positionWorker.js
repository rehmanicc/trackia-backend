const { getBatch } = require("./positionQueue");
const Position = require("../models/Position");
const Device = require("../models/Device");
const socket = require("../socket");
const { getQueueSize } = require("./positionQueue");
async function processBatch() {
    console.log("📦 Queue size:", getQueueSize());
    try {
        const batch = getBatch(200); // process 200 at a time

        if (batch.length === 0) return;

        const io = socket.getIO();

        // flatten (because we pushed arrays)
        const positions = batch.flat();

        const deviceIds = [...new Set(positions.map(p => p.deviceId))];

        // preload devices
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
            if (!p || !p.deviceId || !p.latitude || !p.longitude) continue;
            const device = deviceMap[p.deviceId];
            if (!device) continue;

            // skip inactive
            if (!device.isActive || new Date() > new Date(device.expiryDate)) {
                continue;
            }

            // DB write
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

        // bulk DB write
        if (bulkOps.length > 0) {
            await Position.bulkWrite(bulkOps);
        }

        // emit to socket
        if (io && activePositions.length > 0) {
            io.emit("positions", activePositions.slice(-50)); // last 50 only
        }

        console.log("⚡ Processed batch:", activePositions.length);

    } catch (err) {
        console.error("❌ Worker error:", err);
    }
}

// run continuously
setInterval(processBatch, 200);

module.exports = {};
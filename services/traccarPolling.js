const traccarAPI = require("./traccarAPI");
const { addToQueue } = require("./positionQueue");

let isRunning = false;

async function pollPositions() {
  if (isRunning) {
    console.log("⏳ Skipping (already running)");
    return;
  }

  isRunning = true;

  try {
    console.log("🔄 Polling positions...");

    const positions = await traccarAPI.getPositions();

    if (!positions || positions.length === 0) {
      return;
    }

    // normalize for worker
    const normalized = positions.map(p => ({
      deviceId: p.deviceId,
      latitude: p.latitude,
      longitude: p.longitude,
      deviceTime: p.deviceTime,
      speed: p.speed,
      course: p.course,
      attributes: p.attributes || {}
    }));

    addToQueue(normalized);

  } catch (err) {
    console.error("❌ Polling error:", err.message);
  }

  isRunning = false;
}

// run every 2 seconds
setInterval(pollPositions, 1000);

module.exports = {};
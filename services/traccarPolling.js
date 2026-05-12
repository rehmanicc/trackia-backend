const traccarAPI = require("./traccarAPI");
const { addToQueue } = require("./positionQueue");

let isRunning = false;
let lastPositionId = 0;
async function pollPositions() {
  if (isRunning) return;

  isRunning = true;

  try {
    //console.log("🔄 Polling positions...");

    const positions =
      await traccarAPI.getPositions();

    const fresh = positions.filter(
      p => p.id > lastPositionId
    );

    if (fresh.length > 0) {
      lastPositionId = Math.max(
        ...fresh.map(p => p.id)
      );
    }

    // ✅ correct empty check
    if (!fresh || fresh.length === 0) {
      return;
    }

    const normalized = fresh.map(p => ({
      positionId: p.id,
      deviceId: p.deviceId,
      latitude: p.latitude,
      longitude: p.longitude,
      deviceTime: p.deviceTime,

      // ✅ normalized
      speed: Number(p.speed) || 0,
      course: Number(p.course) || 0,

      attributes: p.attributes || {}
    }));

    addToQueue(normalized);

  } catch (err) {

    console.error(
      "❌ Polling error:",
      err.message
    );

  } finally {

    // ✅ always resets
    isRunning = false;
  }
}
async function startPollingLoop() {
  while (true) {
    try {
      await pollPositions();
    } catch (err) {
      console.error("Polling loop error:", err);
    }

    await new Promise(resolve => setTimeout(resolve, 800));
  }
}

function startPolling() {
  startPollingLoop();
}

module.exports = { startPolling };
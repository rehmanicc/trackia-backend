const traccarAPI = require("./traccarAPI");
const { addToQueue } = require("./positionQueue");

let isRunning = false;

async function pollPositions() {
  if (isRunning) return; 

  isRunning = true;

  try {
    //console.log("🔄 Polling positions...");

    const positions = await traccarAPI.getPositions();

    if (!positions || positions.length === 0) return;

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
const traccarController = require("../controllers/traccarController");

let isRunning = false;

async function pollPositions() {
  if (isRunning) {
    console.log("⏳ Skipping (already running)");
    return;
  }

  isRunning = true;

  try {
    console.log("🔄 Polling positions...");

    const req = {};
    const res = {
      json: () => {},
      status: () => ({ json: () => {} })
    };

    await traccarController.getPositions(req, res);

  } catch (err) {
    console.error("❌ Polling error:", err.message);
  }

  isRunning = false;
}

function startPolling() {
  console.log("🚀 Polling started...");

  setInterval(pollPositions, 5000);

  // 🔥 run immediately (important)
  pollPositions();
}

module.exports = { startPolling };
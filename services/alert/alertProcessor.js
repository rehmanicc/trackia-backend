const { detectAlerts } = require("./alertRules");
const { createAlert } = require("./alertService");

// 🔥 MAIN ALERT HANDLER
async function handleAlerts(position, io) {
  try {
    const alerts = await detectAlerts({
      deviceId: position.deviceId,
      speed: position.speed,
      attributes: position.attributes || {}
    });

    for (const alert of alerts) {
  try {
    await createAlert({
      deviceId: String(position.deviceId),
      type: alert.type,
      message: alert.message,
      metadata: alert.metadata || {},
      priority: alert.priority
    }, io);
  } catch (err) {
    console.error("❌ Single alert failed:", {
      type: alert.type,
      error: err.message
    });
  }
}

  } catch (err) {
    console.error("❌ Alert processing error:", err.message);
  }
}

module.exports = { handleAlerts };
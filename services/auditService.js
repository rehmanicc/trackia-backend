const AuditLog = require("../../models/AuditLog");

async function logAudit({ userId, action, entity, entityId, metadata }) {
  try {
    await AuditLog.create({
      userId,
      action,
      entity,
      entityId,
      metadata,
      timestamp: new Date()
    });
  } catch (err) {
    console.error("Audit log failed:", err.message);
  }
}

module.exports = { logAudit };
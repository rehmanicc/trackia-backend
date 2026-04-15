const mongoose = require("mongoose");

const auditSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  action: String,
  entity: String,
  entityId: mongoose.Schema.Types.ObjectId,
  metadata: Object,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("AuditLog", auditSchema);
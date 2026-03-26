const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema({

    name: String,
    uniqueId: String,

    // 🔥 LINK TO COMPANY
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company"
    },

    // 🔥 WHO CREATED
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    // 🔥 WHO CAN ACCESS (ADMIN/USER)
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }

}, { timestamps: true });

module.exports = mongoose.model("Device", deviceSchema);
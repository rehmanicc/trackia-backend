const mongoose = require("mongoose");

const SystemSettingsSchema =
  new mongoose.Schema({

    contact: {

      phone: {
        type: String,
        default: "",
      },

      email: {
        type: String,
        default: "",
      },

      website: {
        type: String,
        default: "",
      },

      address: {
        type: String,
        default: "",
      },
    },

  }, {
    timestamps: true,
  });

module.exports = mongoose.model(
  "SystemSettings",
  SystemSettingsSchema
);
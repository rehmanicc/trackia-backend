const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({

name: String,

email: {
type: String,
unique: true
},

password: String,

role: {
type: String,
enum: ["owner","admin","user"],
default: "user"
},

companyId: {
type: mongoose.Schema.Types.ObjectId,
ref: "Company"
}

});

module.exports = mongoose.model("User", userSchema);
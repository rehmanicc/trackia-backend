const mongoose = require("mongoose")

const ArchiveSchema = new mongoose.Schema({

deviceId:Number,

latitude:Number,

longitude:Number,

speed:Number,

timestamp:Date,

archivedAt:{
type:Date,
default:Date.now,
index:{ expires:15552000 }
}

})

module.exports = mongoose.model("PositionArchive", ArchiveSchema)
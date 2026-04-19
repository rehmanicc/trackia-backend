const mongoose = require("mongoose")

const TripSchema = new mongoose.Schema({

deviceId:Number,

startTime:Date,

endTime:Date,

startLat:Number,
startLng:Number,

endLat:Number,
endLng:Number,

distance:Number,

duration:Number

})

module.exports = mongoose.model("Trip", TripSchema)
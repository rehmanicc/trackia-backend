const Position = require("../models/Position")
const Trip = require("../models/Trip")

exports.detectTrips = async (deviceId)=>{

const positions = await Position.find({ deviceId })
.sort({ timestamp:1 })

let tripStart = null

for(let pos of positions){

const speed = pos.speed * 1.852 // convert knots → km/h

if(speed > 5 && !tripStart){

tripStart = pos

}

if(speed === 0 && tripStart){

const tripEnd = pos

const duration = (tripEnd.timestamp - tripStart.timestamp)/1000

await Trip.create({

deviceId: deviceId,

startTime: tripStart.timestamp,
endTime: tripEnd.timestamp,

startLat: tripStart.latitude,
startLng: tripStart.longitude,

endLat: tripEnd.latitude,
endLng: tripEnd.longitude,

duration: duration

})

tripStart = null

}

}

}
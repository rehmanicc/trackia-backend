const cron = require("node-cron")
const Position = require("../models/Position")
const PositionArchive = require("../models/PositionArchive")

cron.schedule("0 2 * * *", async () => {

console.log("Archive job started")

try{

const date = new Date()
date.setDate(date.getDate() - 30)

const oldPositions = await Position.find({
timestamp: { $lt: date }
})

if(oldPositions.length === 0){
console.log("No data to archive")
return
}

await PositionArchive.insertMany(oldPositions)

await Position.deleteMany({
timestamp: { $lt: date }
})

console.log("Archived records:", oldPositions.length)

}catch(err){
console.error("Archive error:", err)
}

})
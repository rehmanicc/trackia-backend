function sendPush(io, alert) {
    if (!io) return;

    io.emit("alert", alert); // same event tum already use kar rahe ho
}

module.exports = { sendPush };
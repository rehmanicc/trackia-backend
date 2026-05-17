function sendPush(io, alert, userId) {

  if (!io || !userId) return;

  io.to(`user_${userId}`)
    .emit("alert", alert);
}

module.exports = { sendPush };
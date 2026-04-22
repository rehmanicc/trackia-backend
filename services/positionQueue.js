const queue = [];

// ✅ Add incoming data
function addToQueue(data) {
  queue.push(data);
}

// ✅ Get batch for processing
function getBatch(size = 100) {
  return queue.splice(0, size);
}

// ✅ Optional: monitor size
function getQueueSize() {
  return queue.length;
}

module.exports = {
  addToQueue,
  getBatch,
  getQueueSize
};
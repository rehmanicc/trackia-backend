const queue = [];

// ✅ Add incoming data
function addToQueue(data) {

    if (queue.length > 10000) {

        console.warn(
            `⚠️ Queue overflow (${queue.length}), dropping 5000 oldest items`
        );

        queue.splice(0, 5000);
    }

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
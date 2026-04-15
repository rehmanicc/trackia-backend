// ===============================
// STATUS ENGINE (CORE)
// ===============================

const STATUS = {
    MOVING: "moving",
    IDLE: "idle",
    STOPPED: "stopped",
    OFFLINE: "offline"
};

const CONFIG = {
    speedThreshold: 5,        // km/h
    offlineTimeout: 120,      // seconds
};

export function computeStatus(pos) {

    if (!pos || !pos.deviceTime) {
        return STATUS.OFFLINE;
    }

    const now = Date.now();
    const lastUpdate = new Date(pos.deviceTime).getTime();
    const diff = (now - lastUpdate) / 1000;

    if (diff > CONFIG.offlineTimeout) {
        return STATUS.OFFLINE;
    }

    const speed = pos.speedKmh ?? 0;

    if (speed > CONFIG.speedThreshold) {
        return STATUS.MOVING;
    }

    if (speed === 0) {
        return STATUS.STOPPED;
    }

    return STATUS.IDLE;
}


// ===============================
// BULK STATUS (for counters)
// ===============================
export function computeAllStatuses(lastPositions) {

    const counts = {
        moving: 0,
        idle: 0,
        stopped: 0,
        offline: 0
    };

    const statusMap = {};

    Object.entries(lastPositions).forEach(([id, pos]) => {

        const status = computeStatus(pos);

        statusMap[id] = status;

        counts[status]++;
    });

    return { counts, statusMap };
}
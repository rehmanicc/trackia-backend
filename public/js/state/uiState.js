const state = {
    activePanel: "live",
    selectedVehicleId: null,
    mode: "live"
};

const listeners = [];

export function getState() {
    return state;
}

export function setState(newState) {
    Object.assign(state, newState);

    // notify all listeners
    listeners.forEach(fn => fn(state));
}

export function subscribe(fn) {
    listeners.push(fn);
}
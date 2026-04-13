const state = {
    activePanel: "live",
    selectedVehicleId: null,
    mode: "live"
};

const listeners = new Set();

export function getState() {
    return state;
}

export function setState(newState) {
    const prevState = { ...state }; 

    Object.assign(state, newState);

    listeners.forEach(fn => fn(state, prevState)); 
}

export function subscribe(fn) {
    listeners.add(fn);
}
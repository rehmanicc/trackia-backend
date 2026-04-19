export const appState = {
    userRole: null,
    userPermissions: [], // ✅ ADD THIS
    cachedUsers: [],
    allDevices: []
};
window.appState = appState;
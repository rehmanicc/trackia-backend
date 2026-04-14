import { appState } from "../state/appState.js";

export function hasPermission(permission) {

    // ✅ Owner bypass
    if (appState.userRole === "owner") return true;

    // ✅ Use centralized permissions
    return appState.userPermissions.includes(permission);
}
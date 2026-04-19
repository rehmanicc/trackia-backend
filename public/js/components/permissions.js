import { appState } from "../state/appState.js";

export function hasPermission(permission) {

    const role = appState.userRole;
    const perms = appState.userPermissions || [];

    // ✅ OWNER → full access
    if (role === "owner") return true;

    // ✅ ADMIN → restricted
    if (role === "admin") {

        // ❌ Admin cannot renew unless explicitly allowed
        if (permission === "RENEW_DEVICE" && !perms.includes("RENEW_DEVICE")) {
            return false;
        }

        return perms.includes(permission);
    }

    // ✅ USER → only assigned permissions
    if (role === "user") {
        return perms.includes(permission);
    }

    return false;
}
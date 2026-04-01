import { onAlert } from "/js/services/socketService.js";
import { apiRequest } from "/js/services/apiService.js";

export function initAlertModule() {

    // 🔴 SOCKET HANDLING MOVED HERE
    onAlert((alert) => {

        console.log("🚨 ALERT RECEIVED:", alert);

        window.alertUI.showToast(alert.message, "error");

        window.alertManager.addAlert(
            alert.deviceId,
            alert.metadata?.geofenceId || null,
            alert.type.toLowerCase(),
            alert.message
        );
    });
}

export async function loadInitialAlerts() {

    try {
        const data = await apiRequest("/api/alerts");

        window.alertManager.setAlerts(
            data.map(a => ({
                deviceId: a.deviceId,
                geofenceId: a.metadata?.geofenceId || null,
                type: a.type.toLowerCase(),
                message: a.message,
                time: new Date(a.timestamp)
            }))
        );

    } catch (err) {
        console.error("❌ Failed to load alerts", err);
    }
}
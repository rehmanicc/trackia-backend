import { onAlert } from "/js/services/socketService.js";
import { apiRequest } from "/js/services/apiService.js";

let alertList = [];

export function initAlertModule() {

    loadInitialAlerts();

   onAlert((alert) => {

    console.log("🚨 ALERT RECEIVED:", alert);
       const exists = alertList.find(a =>
        a.deviceId === alert.deviceId &&
        a.type === alert.type &&
        new Date(a.timestamp).getTime() === new Date(alert.timestamp).getTime()
    );

    if (exists) return;
    alertList.unshift(alert);

    window.alertUI.renderAlerts(alertList);
    window.alertUI.showToast(alert.message, "error");
});
}

export async function loadInitialAlerts() {

    try {
        const data = await apiRequest("/api/alerts");

        alertList = data;

        window.alertUI.renderAlerts(alertList);

    } catch (err) {
        console.error("❌ Failed to load alerts", err);
    }
}
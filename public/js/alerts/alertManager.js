let alerts = [];

function addAlert(deviceId, geofenceId, type, message) {

    alerts.unshift({
        deviceId,
        geofenceId,
        type,
        message,
        time: new Date()
    });

    if (alerts.length > 100) alerts.pop();

    // notify UI
    if (window.alertUI) {
        window.alertUI.renderAlerts(alerts);
    }
}

function setAlerts(newAlerts) {
    alerts = newAlerts;

    if (window.alertUI) {
        window.alertUI.renderAlerts(alerts);
    }
}

window.alertManager = {
    addAlert,
    setAlerts,
    getAlerts: () => alerts
};
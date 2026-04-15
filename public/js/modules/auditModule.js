import { apiRequest } from "/js/services/apiService.js";

export async function loadAuditLogs() {
    try {
        const data = await apiRequest("/api/audit");

        const container = document.getElementById("auditList");
        if (!container) return;

        container.innerHTML = "";

        data.forEach(log => {
            const div = document.createElement("div");
            div.className = "vehicle-card";

            div.innerHTML = `
                <b>${log.action}</b><br>
                Device: ${log.entityId}<br>
                User: ${log.userId}<br>
                <small>${new Date(log.timestamp).toLocaleString()}</small>
            `;

            container.appendChild(div);
        });

    } catch (err) {
        console.error("Audit load failed", err);
    }
}
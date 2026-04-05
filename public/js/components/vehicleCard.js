export function createVehicleCard({ pos, device, isAnalytics, statusClass }) {

    const speed = Math.round((pos.speed || 0) * 1.852);
    const minutesAgo = Math.floor((new Date() - new Date(pos.deviceTime)) / 60000);

    const actionButton = isAnalytics
        ? `<button 
            onclick="selectDeviceForAnalytics('${pos.deviceId}')"
            class="btn-action btn-analytics">
            📊 Trip Details
           </button>`
        : `<button 
            onclick="openPlaybackModal('${pos.deviceId}')"
            class="btn-action btn-playback">
            ▶ Playback
           </button>`;

    return `
        <div class="vehicle-header">
            <div class="vehicle-name">
                🚗 ${device.name || "Vehicle " + pos.deviceId}
            </div>

            <div class="status-badge ${statusClass}">
                ${device.status || "offline"}
            </div>
        </div>

        <div class="vehicle-body">
            <div>
                <div>Speed: <b>${speed} km/h</b></div>
                <div>Last update: ${minutesAgo} min ago</div>
            </div>

            ${actionButton}
        </div>
    `;
}
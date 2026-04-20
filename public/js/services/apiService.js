const BASE_URL = "http://195.35.7.110:5000";

export async function apiRequest(path, options = {}) {

    const token = localStorage.getItem("token");

    try {
        const res = await fetch(BASE_URL + path, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(token && { "Authorization": "Bearer " + token }),
                ...(options.headers || {})
            }
        });

        // 🔴 HANDLE AUTH ERROR FIRST (IMPORTANT)
        if (res.status === 401) {
            console.warn("⚠️ Session expired");

            localStorage.removeItem("token");

            // 🔥 Safe UI switch
            const login = document.getElementById("loginSection");
            const dashboard = document.getElementById("loggedInSection");

            if (login) login.style.display = "block";
            if (dashboard) dashboard.style.display = "none";

            // 🔥 STOP further processing
            return null;
        }

        const text = await res.text();

        let data;

        // 🔴 SAFE JSON PARSING
        try {
            data = text ? JSON.parse(text) : {};
        } catch (err) {
            console.error("❌ Invalid JSON response:", text);
            throw new Error("Server returned invalid response");
        }

        // 🔴 HANDLE API ERRORS
        if (!res.ok) {
            console.error("❌ FULL BACKEND RESPONSE:", data);

            throw new Error(
                data.message ||
                data.error ||
                JSON.stringify(data) ||
                "API Error"
            );
        }

        return data;

    } catch (err) {
        console.error("❌ API ERROR:", err.message);
        throw err;
    }
}
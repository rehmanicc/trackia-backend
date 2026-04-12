const BASE_URL = "https://trackia-backend.onrender.com";

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
            console.warn("⚠️ Session expired. Redirecting to login...");

            localStorage.removeItem("token");

            // redirect to login page
            window.location.href = "/login.html";
            return;
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
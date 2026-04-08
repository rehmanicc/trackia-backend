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

        const text = await res.text();

        let data;
        try {
            data = text ? JSON.parse(text) : {};
        } catch {
            throw new Error("Invalid JSON response");
        }

        if (!res.ok) {
            console.error("FULL BACKEND RESPONSE:", data);

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
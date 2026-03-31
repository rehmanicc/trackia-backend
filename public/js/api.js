const BASE_URL = "https://trackia-backend.onrender.com";

function getToken() {
  return localStorage.getItem("token");
}

async function apiFetch(endpoint, options = {}) {
  const token = getToken();

  const res = await fetch(BASE_URL + endpoint, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      Authorization: "Bearer " + token
    }
  });

  // 🔥 HANDLE TOKEN FIRST
  if (res.status === 401) {
    alert("Session expired. Please login again.");
    localStorage.removeItem("token");
    window.location.href = "login.html";
    return;
  }

  const text = await res.text();

  // 🔥 Try parsing safely
  let data;

  try {
    data = JSON.parse(text);
  } catch (err) {
    console.error("❌ Non-JSON response from server:", text);
    throw new Error("Server returned invalid response");
  }

  // 🔥 Handle HTTP errors AFTER parsing
  if (!res.ok) {
    throw new Error(data.error || "API Error");
  }

  return data;
}
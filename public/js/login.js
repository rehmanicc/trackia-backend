async function handleLogin() {

    const phoneNumber = document.getElementById("loginPhone").value;
    const password = document.getElementById("loginPassword").value;

    if (!phoneNumber || !password) {
        alert("Enter credentials");
        return;
    }

    try {
        const response = await fetch("https://trackia-backend.onrender.com/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ phoneNumber, password })
        });

        const data = await response.json();

        // ✅ SUCCESS
        if (response.ok && data.token) {

            localStorage.setItem("token", data.token);

            alert("Login successful");

            // ✅ switch UI
            document.getElementById("loginSection").style.display = "none";
            document.getElementById("loggedInSection").style.display = "flex";

            window.location.reload();

        } 
        // ❌ FAILURE
        else {
            alert(data.error || "Login failed");
        }

    } catch (err) {
        console.error(err);
        alert("Server error");
    }
}

// ✅ MAKE GLOBAL
window.handleLogin = handleLogin;
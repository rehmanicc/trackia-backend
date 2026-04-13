async function handleLogin() {

const phoneNumber = document.getElementById("loginPhone").value
const password = document.getElementById("loginPassword").value

if (!phoneNumber || !password) {
    alert("Enter credentials")
    return
}

const response = await fetch("https://trackia-backend.onrender.com/api/auth/login", {
    method:"POST",
    headers:{
        "Content-Type":"application/json"
    },
    body:JSON.stringify({ phoneNumber, password })
})

const data = await response.json()

if(response.ok && data.token){

    localStorage.setItem("token",data.token)

    alert("Login successful")

    window.location.href = "/index.html";

}else{
    alert(data.error || "Login failed")
}

}

// 🔥 MAKE GLOBAL
window.handleLogin = handleLogin;
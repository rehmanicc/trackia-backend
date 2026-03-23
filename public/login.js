async function login(){

const email = document.getElementById("email").value
const password = document.getElementById("password").value

const response = await fetch("https://trackia-backend.onrender.com/api/auth/login", {

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({
email,
password
})

})

const data = await response.json()

if(response.ok && data.token){

localStorage.setItem("token",data.token)

alert("Login successful")

window.location.href="dashboard.html"

}else{

alert(data.error || "Login failed")

}

}
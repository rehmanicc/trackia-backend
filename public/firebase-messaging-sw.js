importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js");



const firebaseConfig = {
  apiKey: "AIzaSyARTNHa7_oa28ZM5qfOuxa55bvwzEWZpNc",
  authDomain: "trackiatech.firebaseapp.com",
  projectId: "trackiatech",
  storageBucket: "trackiatech.firebasestorage.app",
  messagingSenderId: "592029796394",
  appId: "1:592029796394:web:81218f9d0fba816f66db53"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log("📩 Background message:", payload);

  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: "/icon.png"
  });
});
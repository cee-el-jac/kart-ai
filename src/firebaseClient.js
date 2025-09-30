// src/firebaseClient.js
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// ⬇️ Paste YOUR real config from Firebase console here
const firebaseConfig = {
  apiKey: "AIzaSyC3w7AkG9tdW9-VPbkN_B9B0yzzKLDLz9E",
  authDomain: "kart-ai-914b8.firebaseapp.com",       // e.g. kart-ai.firebaseapp.com
  projectId: "kart-ai-914b8",             // must match your project id
  storageBucket: "kart-ai-914b8.firebasestorage.app",     // e.g. kart-ai.appspot.com
  messagingSenderId: "642735553778",
  appId: "1:642735553778:web:a89f6576438a755505a46b",
};

// Avoid duplicate init during Vite hot-reload
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const db = getFirestore(app);

// TEMP: prove we’re pointed to the right Firebase project
console.log("Firebase connected:", app.options.projectId); 









// src/firebaseClient.js
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC3w7AkGt9dw-VPbkn_B89byzzkLDL29E",
  authDomain: "kart-ai-914b8.firebaseapp.com",
  projectId: "kart-ai-914b8",
  storageBucket: "kart-ai-914b8.appspot.com",
  messagingSenderId: "642735553778",
  appId: "1:642735553778:web:a896f576438a75556a46b",
  measurementId: "G-VZZ3NMJZB3",
};

// Avoid duplicate init during hot reload
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Firestore instance
export const db = getFirestore(app);









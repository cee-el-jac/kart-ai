// src/firebaseClient.js
import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyC3w7AkGt9dw-VPbKh_B89byzzkLDL29E",
  authDomain: "kart-ai-914b8.firebaseapp.com",
  projectId: "kart-ai-914b8",
  storageBucket: "kart-ai-914b8.appspot.com",
  messagingSenderId: "642735553778",
  appId: "1:642735553778:web:a896f5676438a755505a46b",
  measurementId: "G-VZZ3NJMZB3",
};

export const app = initializeApp(firebaseConfig);


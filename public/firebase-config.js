//Configuración para el frontend
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// configuración de Firebase para el frontend 
const firebaseConfig = {
  apiKey: "AIzaSyCHDv1QIe0weBFWrj-XwVPTK6j_jKq711o",
  authDomain: "aurora-2b8f4.firebaseapp.com",
  projectId: "aurora-2b8f4",
  storageBucket: "aurora-2b8f4.firebasestorage.app",
  messagingSenderId: "430389503426",
  appId: "1:430389503426:web:97405acdca08921740625b",
  measurementId: "G-KQ123HTK5L"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Backend URL 
export const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://127.0.0.1:3000' 
  : 'https://admin-aurora-1z8p.onrender.com'; 

console.log(' Firebase configurado para:', firebaseConfig.projectId);
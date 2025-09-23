import { auth, BACKEND_URL } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Verificar autenticación al cargar la página
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.log("No hay usuario autenticado, redirigiendo a login...");
    window.location.href = "loginAdmin.html";
    return;
  }

  try {
    console.log("=== INICIO VERIFICACIÓN ADMIN ===");
    console.log("Usuario autenticado:", user.email);
    console.log("UID:", user.uid);

    // Verificar token actual
    const currentToken = await user.getIdTokenResult(true);
    console.log("Claims actuales:", currentToken.claims);
    console.log("¿Tiene claim de admin?", currentToken.claims.admin);

    // Verificar que tiene privilegios de admin
    const idToken = await user.getIdToken(true);
    console.log("Token obtenido, verificando con el backend...");
    console.log("BACKEND_URL:", BACKEND_URL);

    const response = await fetch(`${BACKEND_URL}/api/login/verify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
    });

    console.log("Status de respuesta:", response.status);
    console.log("Headers de respuesta:", response.headers);
    
    let responseData;
    try {
      responseData = await response.json();
      console.log("Datos de la respuesta:", responseData);
    } catch (jsonError) {
      console.error("Error parseando JSON:", jsonError);
      const textResponse = await response.text();
      console.log("Respuesta como texto:", textResponse);
      throw new Error("Respuesta inválida del servidor");
    }

    if (!response.ok) {
      console.error("Error del servidor:", responseData);
      throw new Error(responseData.error || `Error ${response.status}: ${response.statusText}`);
    }

    // Verificar estructura de respuesta
    if (!responseData.admin) {
      console.error("Estructura de respuesta inválida:", responseData);
      throw new Error("Estructura de respuesta inválida del servidor");
    }

    const adminData = responseData.admin;

    // Mostrar información del admin
    document.getElementById("userEmail").textContent = adminData.email;
    document.getElementById("adminEmail").textContent = adminData.email;
    document.getElementById("adminUid").textContent = adminData.uid;
    document.getElementById("adminCreated").textContent = new Date(
      adminData.createdAt
    ).toLocaleDateString();

    // Ocultar loading y mostrar dashboard
    document.getElementById("loading").style.display = "none";
    document.getElementById("dashboard").style.display = "block";
    
    console.log("=== VERIFICACIÓN EXITOSA ===");

  } catch (error) {
    console.error("=== ERROR EN VERIFICACIÓN ===");
    console.error("Error completo:", error);
    console.error("Mensaje:", error.message);
    console.error("Stack:", error.stack);
    
    alert(`Error de verificación: ${error.message}`);
    window.location.href = "loginAdmin.html";
  }
});

// Función global para logout
window.logout = async () => {
  try {
    await signOut(auth);
    localStorage.removeItem("firebaseIdToken");
    localStorage.removeItem("adminData");
    window.location.href = "loginAdmin.html";
  } catch (error) {
    console.error("Error en logout:", error);
  }
};
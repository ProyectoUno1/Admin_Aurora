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
    console.log("Usuario autenticado:", user.email);
    console.log("UID:", user.uid);

    // Verificar token actual
    const currentToken = await user.getIdTokenResult(true);
    console.log("Claims actuales:", currentToken.claims);

    // Verificar que tiene privilegios de admin
    const idToken = await user.getIdToken(true);
    console.log("Token obtenido, verificando con el backend...");

    const response = await fetch(`${BACKEND_URL}/api/login/verify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
    });

    console.log("Respuesta del servidor:", response.status);
    const responseData = await response.json();
    console.log("Datos de la respuesta:", responseData);

    if (!response.ok) {
      throw new Error(responseData.error || "No es administrador");
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
  } catch (error) {
    console.error("Error verificando admin:", error);
    alert("Error: No tienes privilegios de administrador");
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

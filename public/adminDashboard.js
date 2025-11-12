import { auth, BACKEND_URL } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Verificar autenticaciÃ³n al cargar la pÃ¡gina
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.log("No hay usuario autenticado, redirigiendo a login...");
    window.location.href = "loginAdmin.html";
    return;
  }

  try {
    console.log("=== INICIO VERIFICACIÃ“N ADMIN ===");
    console.log("Usuario autenticado:", user.email);
    console.log("UID:", user.uid);

    // Verificar token actual
    const currentToken = await user.getIdTokenResult(true);
    console.log("Claims actuales:", currentToken.claims);
    console.log("Â¿Tiene claim de admin?", currentToken.claims.admin);

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
      throw new Error("Respuesta invÃ¡lida del servidor");
    }

    if (!response.ok) {
      console.error("Error del servidor:", responseData);
      throw new Error(responseData.error || `Error ${response.status}: ${response.statusText}`);
    }

    // Verificar estructura de respuesta
    if (!responseData.admin) {
      console.error("Estructura de respuesta invÃ¡lida:", responseData);
      throw new Error("Estructura de respuesta invÃ¡lida del servidor");
    }

    const adminData = responseData.admin;

    // Mostrar informaciÃ³n del admin
    document.getElementById("userEmail").textContent = adminData.email;
    document.getElementById("adminEmail").textContent = adminData.email;
    document.getElementById("adminUid").textContent = adminData.uid;
    document.getElementById("adminCreated").textContent = new Date(
      adminData.createdAt
    ).toLocaleDateString();

    // Cargar estadÃ­sticas
    await loadPsychologistStats();
    await loadArticleStats(idToken);
    await loadAppointmentStats(idToken);

    fetchPatientStats(idToken);

    // Ocultar loading y mostrar dashboard
    document.getElementById("loading").style.display = "none";
    document.getElementById("dashboard").style.display = "block";
    
    console.log("=== VERIFICACIÃ“N EXITOSA ===");

  } catch (error) {
    console.error("=== ERROR EN VERIFICACIÃ“N ===");
    console.error("Error completo:", error);
    console.error("Mensaje:", error.message);
    
    // REEMPLAZO DE alert() por SweetAlert2
    await Swal.fire({
      icon: 'error',
      title: 'Error de VerificaciÃ³n',
      text: `Error de verificaciÃ³n: ${error.message}. Redirigiendo a login...`,
      confirmButtonText: 'Entendido'
    });
    
    window.location.href = "loginAdmin.html";
  }
});

// Cargar estadísticas de psicólogos
async function loadPsychologistStats() {
  try {
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`${BACKEND_URL}/api/stats/psychologists`, {
      headers: {
        'Authorization': `Bearer ${idToken}`
      }
    });

    if (response.ok) {
      const stats = await response.json();
      document.getElementById('totalPsychologists').textContent = stats.total || 0;
      document.getElementById('activePsychologists').textContent = stats.active || 0;
      document.getElementById('pendingPsychologists').textContent = stats.pending || 0;
      
      const pendingValidationsBadge = document.getElementById('pendingValidations'); 
      if (pendingValidationsBadge) {
        pendingValidationsBadge.textContent = `${stats.pending || 0} pendientes`;
      }
      
    } else {
      console.error('Error cargando estadísticas de psicólogos. Código:', response.status);
      document.getElementById('totalPsychologists').textContent = 'Error';
      document.getElementById('activePsychologists').textContent = 'Error';
      document.getElementById('pendingPsychologists').textContent = 'Error';
    }
  } catch (error) {
    console.error('Error cargando estadísticas de psicólogos:', error);
    document.getElementById('totalPsychologists').textContent = 'Error';
    document.getElementById('activePsychologists').textContent = 'Error';
    document.getElementById('pendingPsychologists').textContent = 'Error';
  }
}

// Cargar estadísticas de artículos
async function loadArticleStats(idToken) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/admin/articles/stats/overview`, {
      headers: {
        'Authorization': `Bearer ${idToken}`
      }
    });

    if (response.ok) {
      const stats = await response.json();
      
      const total = stats.total || 0;
      const drafts = stats.draft || 0; 
      
      document.getElementById('totalArticles').textContent = total;
      document.getElementById('pendingArticles').textContent = drafts;

      const pendingArticlesBadge = document.getElementById('pendingArticlesBadge'); 
      if (pendingArticlesBadge) {
        pendingArticlesBadge.textContent = `${drafts} pendientes`;
      }
      
    } else {
      console.error('Error cargando estadísticas de artículos. Código:', response.status);
      document.getElementById('totalArticles').textContent = 'Error';
      document.getElementById('pendingArticles').textContent = 'Error';
    }
  } catch (error) {
    console.error('Error cargando estadísticas de artículos:', error);
    document.getElementById('totalArticles').textContent = 'Error';
    document.getElementById('pendingArticles').textContent = 'Error';
  }
}

// Cargar estadísticas de sesiones (appointments)
// Cargar estadísticas de sesiones (appointments)
// Cargar estadísticas de sesiones (appointments)
// Cargar estadísticas de sesiones (appointments)
async function loadAppointmentStats(idToken) {
  try {
    // Usamos el endpoint que lista las citas, que es más probable que funcione.
    const response = await fetch(`${BACKEND_URL}/api/admin/appointments`, {
      headers: {
        'Authorization': `Bearer ${idToken}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      
      // Asumimos que la respuesta tiene una clave 'appointments' que es un array
      const appointments = data.appointments || []; 
      
      let totalAppointments = appointments.length;
      let completedAppointments = 0;
      let pendingAppointments = 0;
      
      // Contar estados de citas directamente en el frontend
      appointments.forEach(appointment => {
          // Ajusta las claves de estado según las que use tu backend (ej: 'status')
          const status = appointment.status ? appointment.status.toUpperCase() : 'PENDING';

          if (status === 'COMPLETED' || status === 'FINISHED') {
              completedAppointments++;
          } else if (status === 'PENDING' || status === 'SCHEDULED' || status === 'UPCOMING') {
              pendingAppointments++;
          }
          // El total ya está cubierto por el largo del array
      });
      
      // Si el total de citas viene como una propiedad de la respuesta, úsala.
      totalAppointments = data.totalAppointments || appointments.length;

      // Actualizar las tarjetas del dashboard
      document.getElementById('totalAppointments').textContent = totalAppointments;
      document.getElementById('completedAppointments').textContent = completedAppointments;
      document.getElementById('pendingAppointments').textContent = pendingAppointments;

    } else {
      console.error('Error cargando estadísticas de sesiones. Código:', response.status);
      document.getElementById('totalAppointments').textContent = 'Error';
      document.getElementById('completedAppointments').textContent = 'Error';
      document.getElementById('pendingAppointments').textContent = 'Error';
    }
  } catch (error) {
    console.error('Error cargando estadísticas de sesiones:', error);
    document.getElementById('totalAppointments').textContent = 'Error';
    document.getElementById('completedAppointments').textContent = 'Error';
    document.getElementById('pendingAppointments').textContent = 'Error';
  }
}

async function fetchPatientStats(idToken) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/admin/patients`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${idToken}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            console.error("No se pudieron cargar las estadÃ­sticas de pacientes.");
            return;
        }

        const data = await response.json();
        const patients = data.patients || [];
        
        // Contar pacientes donde isPremium es true
        const subscribedCount = patients.filter(p => p.isPremium === true).length; 
        
        // Actualizar el badge en el Dashboard principal
        const subscribedPatientsBadge = document.getElementById('subscribedPatients');
        subscribedPatientsBadge.textContent = `${subscribedCount} Suscritos`;
        
    } catch (error) {
        console.error("Error al obtener estadÃ­sticas de pacientes:", error);
        document.getElementById('subscribedPatients').textContent = 'Error';
    }
}

// FunciÃ³n global para logout
window.logout = async () => {
  try {
    await signOut(auth);
    localStorage.removeItem("firebaseIdToken");
    localStorage.removeItem("adminData");
    window.location.href = "loginAdmin.html";
  } catch (error) {
    console.error("Error en logout:", error);
    // SweetAlert para el error de logout
    Swal.fire({
      icon: 'error',
      title: 'Error de Cierre de SesiÃ³n',
      text: 'No se pudo cerrar la sesiÃ³n correctamente. Intenta de nuevo.',
    });
  }
};
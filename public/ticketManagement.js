import { auth, BACKEND_URL } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let allTickets = [];
let currentUser = null;

// Verificar autenticación
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.log("No hay usuario autenticado, redirigiendo a login...");
    window.location.href = "loginAdmin.html";
    return;
  }

  currentUser = user;

  try {
    const idToken = await user.getIdToken(true);

    // Verificar privilegios de admin
    const response = await fetch(`${BACKEND_URL}/api/login/verify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("No tienes permisos de administrador");
    }

    const data = await response.json();
    document.getElementById("userEmail").textContent = data.admin.email;

    // Cargar tickets
    await loadTickets();

    document.getElementById("loading").style.display = "none";
    document.getElementById("ticketDashboard").style.display = "block";
  } catch (error) {
    console.error("Error de autenticación:", error);
    await Swal.fire({
      icon: "error",
      title: "Error de Verificación",
      text: error.message,
    });
    window.location.href = "loginAdmin.html";
  }
});

// Función para cargar tickets
window.loadTickets = async function () {
  try {
    const idToken = await currentUser.getIdToken();
    const statusFilter = document.getElementById("statusFilter").value;
    const priorityFilter = document.getElementById("priorityFilter").value;
    const categoryFilter = document.getElementById("categoryFilter").value;

    let url = `${BACKEND_URL}/api/support/tickets?`; 
    if (statusFilter) url += `status=${statusFilter}&`;
    if (priorityFilter) url += `priority=${priorityFilter}&`;
    if (categoryFilter) url += `category=${categoryFilter}&`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Error al cargar los tickets");
    }

    allTickets = await response.json();
    updateStats();
    renderTickets();
  } catch (error) {
    console.error("Error:", error);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "No se pudieron cargar los tickets",
    });
  }
};

// Actualizar estadísticas
function updateStats() {
  const total = allTickets.length;
  const open = allTickets.filter((t) => t.status === "open").length;
  const inProgress = allTickets.filter((t) => t.status === "in_progress").length;
  const resolved = allTickets.filter((t) => t.status === "resolved").length;

  document.getElementById("totalTickets").textContent = total;
  document.getElementById("openTickets").textContent = open;
  document.getElementById("inProgressTickets").textContent = inProgress;
  document.getElementById("resolvedTickets").textContent = resolved;
}

// Renderizar tabla de tickets
function renderTickets() {
  const tbody = document.getElementById("ticketsTableBody");
  const emptyState = document.getElementById("emptyState");

  if (allTickets.length === 0) {
    tbody.innerHTML = "";
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";
  tbody.innerHTML = allTickets
    .map(
      (ticket) => `
    <tr>
      <td>${ticket.id.substring(0, 8)}...</td>
      <td>
        <div style="display: flex; flex-direction: column; gap: 3px;">
          <strong>${ticket.userName || "Usuario"}</strong>
          <small style="color: #666;">${ticket.userEmail}</small>
        </div>
      </td>
      <td>
        <strong>${ticket.subject}</strong>
        <div style="font-size: 0.85rem; color: #666; margin-top: 3px;">
          ${ticket.message.substring(0, 60)}...
        </div>
      </td>
      <td>
        <span class="category-badge">${getCategoryLabel(ticket.category)}</span>
      </td>
      <td>
        <span class="priority-badge ${ticket.priority}">${getPriorityLabel(ticket.priority)}</span>
      </td>
      <td>
        <span class="status-badge ${ticket.status}">${getStatusLabel(ticket.status)}</span>
      </td>
      <td>${formatDate(ticket.createdAt)}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-action btn-view" onclick="viewTicket('${ticket.id}')">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
            </svg>
            Ver
          </button>
          <button class="btn-action btn-delete" onclick="deleteTicket('${ticket.id}')">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
            Eliminar
          </button>
        </div>
      </td>
    </tr>
  `
    )
    .join("");
}

// Helper functions para labels
function getStatusLabel(status) {
  const labels = {
    open: "Abierto",
    in_progress: "En Proceso",
    resolved: "Resuelto",
    closed: "Cerrado",
  };
  return labels[status] || status;
}

function getPriorityLabel(priority) {
  const labels = {
    high: "Alta",
    medium: "Media",
    low: "Baja",
  };
  return labels[priority] || priority;
}

function getCategoryLabel(category) {
  const labels = {
    technical: "Técnico",
    billing: "Facturación",
    general: "General",
    complaint: "Queja",
  };
  return labels[category] || category;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

// Ver detalle del ticket
window.viewTicket = async function (ticketId) {
  const ticket = allTickets.find((t) => t.id === ticketId);
  if (!ticket) return;

  const modalBody = document.getElementById("ticketModalBody");
  const hasResponse = ticket.response && ticket.response.trim() !== "";

  modalBody.innerHTML = `
    <div class="ticket-detail">
      <div class="detail-section">
        <h3>Información del Ticket</h3>
        <div class="detail-row">
          <span class="detail-label">ID:</span>
          <span class="detail-value">${ticket.id}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Usuario:</span>
          <span class="detail-value">${ticket.userName || "Usuario"} (${ticket.userEmail})</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Tipo de usuario:</span>
          <span class="detail-value">${ticket.userType === "patient" ? "Paciente" : "Psicólogo"}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Estado:</span>
          <span class="status-badge ${ticket.status}">${getStatusLabel(ticket.status)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Prioridad:</span>
          <span class="priority-badge ${ticket.priority}">${getPriorityLabel(ticket.priority)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Categoría:</span>
          <span class="category-badge">${getCategoryLabel(ticket.category)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Creado:</span>
          <span class="detail-value">${formatDate(ticket.createdAt)}</span>
        </div>
        ${ticket.updatedAt ? `
        <div class="detail-row">
          <span class="detail-label">Actualizado:</span>
          <span class="detail-value">${formatDate(ticket.updatedAt)}</span>
        </div>
        ` : ""}
      </div>

      <div class="detail-section">
        <h3>Asunto</h3>
        <p><strong>${ticket.subject}</strong></p>
      </div>

      <div class="detail-section">
        <h3>Mensaje del Usuario</h3>
        <div class="message-box">
          ${ticket.message}
        </div>
      </div>

      ${hasResponse ? `
      <div class="detail-section">
        <h3>Respuesta del Equipo</h3>
        <div class="response-box">
          ${ticket.response}
          ${ticket.responseAt ? `<div style="margin-top: 10px; font-size: 0.85rem; color: #666;"><em>Respondido el ${formatDate(ticket.responseAt)}</em></div>` : ""}
        </div>
      </div>
      ` : ""}

      ${!hasResponse || ticket.status !== "resolved" ? `
      <div class="detail-section">
        <h3>${hasResponse ? "Actualizar Respuesta" : "Responder Ticket"}</h3>
        <form class="response-form" onsubmit="submitResponse(event, '${ticket.id}')">
          <div class="form-group">
            <label>Respuesta:</label>
            <textarea id="responseText" required placeholder="Escribe tu respuesta aquí...">${hasResponse ? ticket.response : ""}</textarea>
          </div>
          <div class="form-group">
            <label>Cambiar Estado:</label>
            <select id="responseStatus">
              <option value="in_progress" ${ticket.status === "in_progress" ? "selected" : ""}>En Proceso</option>
              <option value="resolved" ${ticket.status === "resolved" ? "selected" : ""}>Resuelto</option>
              <option value="closed" ${ticket.status === "closed" ? "selected" : ""}>Cerrado</option>
            </select>
          </div>
          <div class="form-actions">
            <button type="button" class="btn-cancel" onclick="closeTicketModal()">Cancelar</button>
            <button type="submit" class="btn-submit">Enviar Respuesta</button>
          </div>
        </form>
      </div>
      ` : ""}
    </div>
  `;

  document.getElementById("ticketModal").style.display = "block";
};

// Cerrar modal
window.closeTicketModal = function () {
  document.getElementById("ticketModal").style.display = "none";
};

// Enviar respuesta
window.submitResponse = async function (event, ticketId) {
  event.preventDefault();

  const responseText = document.getElementById("responseText").value;
  const status = document.getElementById("responseStatus").value;

  try {
    const idToken = await currentUser.getIdToken(true);

    const response = await fetch(`${BACKEND_URL}/api/support/tickets/${ticketId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        response: responseText,
        status: status,
      }),
    });

    if (!response.ok) {
      throw new Error("Error al actualizar el ticket");
    }

    await Swal.fire({
      icon: "success",
      title: "¡Éxito!",
      text: "Respuesta enviada correctamente",
      timer: 2000,
      showConfirmButton: false,
    });

    closeTicketModal();
    await loadTickets();
  } catch (error) {
    console.error("Error:", error);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "No se pudo enviar la respuesta",
    });
  }
};

// Eliminar ticket
window.deleteTicket = async function (ticketId) {
  const result = await Swal.fire({
    title: "¿Estás seguro?",
    text: "Esta acción no se puede deshacer",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#c62828",
    cancelButtonColor: "#666",
    confirmButtonText: "Sí, eliminar",
    cancelButtonText: "Cancelar",
  });

  if (!result.isConfirmed) return;

  try {
    const idToken = await currentUser.getIdToken();

    const response = await fetch(`${BACKEND_URL}/api/support/tickets/${ticketId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Error al eliminar el ticket");
    }

    await Swal.fire({
      icon: "success",
      title: "¡Eliminado!",
      text: "Ticket eliminado correctamente",
      timer: 2000,
      showConfirmButton: false,
    });

    await loadTickets();
  } catch (error) {
    console.error("Error:", error);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "No se pudo eliminar el ticket",
    });
  }
};

// Event listeners para filtros
document.getElementById("statusFilter").addEventListener("change", loadTickets);
document.getElementById("priorityFilter").addEventListener("change", loadTickets);
document.getElementById("categoryFilter").addEventListener("change", loadTickets);

// Cerrar modal al hacer clic fuera
window.onclick = function (event) {
  const modal = document.getElementById("ticketModal");
  if (event.target === modal) {
    closeTicketModal();
  }
};

// Función global para logout
window.logout = async () => {
  try {
    await signOut(auth);
    localStorage.removeItem("firebaseIdToken");
    localStorage.removeItem("adminData");
    window.location.href = "loginAdmin.html";
  } catch (error) {
    console.error("Error en logout:", error);
    Swal.fire({
      icon: "error",
      title: "Error de Cierre de Sesión",
      text: "No se pudo cerrar la sesión correctamente. Intenta de nuevo.",
    });
  }
};
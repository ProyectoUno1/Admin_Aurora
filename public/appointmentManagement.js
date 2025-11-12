// frontend/appointmentManagement.js - CORREGIDO

import { auth, BACKEND_URL } from "./firebase-config.js"; 
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const appointmentsTableBody = document.getElementById('appointmentsTableBody');
const loadingIndicator = document.getElementById('loading-appointments');
const statusFilter = document.getElementById('filter-status');
const detailsModal = document.getElementById('appointmentDetailsModal');
const modalContent = document.getElementById('modal-content'); 
const modalTitle = document.getElementById('modal-title'); 
const dynamicContentArea = document.getElementById('dynamic-content-area');

let allAppointments = [];
let currentUser = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "loginAdmin.html";
        return;
    }
    currentUser = user;
    fetchAppointmentsData(user);
    document.getElementById("userEmail").textContent = user.email;
});

// --- LÓGICA DE PAGO CORREGIDA ---
function getPaymentInfo(paymentType) {
    if (paymentType === 'subscription') {
        return { typeText: 'Suscripción', isSubscription: true };
    }
    return { typeText: 'Pago Único', isSubscription: false }; 
}

function checkRefundEligibility(appt) {
    const { isSubscription } = getPaymentInfo(appt.paymentType); 
    
    // 🆕 Verificar que sea pago único Y que esté pagado
    const isPaidOneTime = appt.isPaid === true && !isSubscription && appt.paymentIntentId;

    // Si ya está reembolsado o no es pago único pagado, no califica
    if (!isPaidOneTime || appt.status === 'refunded') {
        return { needsRefund: false, canRefund: false };
    }
    
    const isCancelled = appt.status === 'cancelled';
    const scheduledDate = new Date(appt.scheduledDateTime);
    const now = new Date();
    
    // 🆕 Cita vencida no completada (ni rated)
    const isOverdue = scheduledDate < now && 
                      appt.status !== 'completed' && 
                      appt.status !== 'rated' &&
                      appt.status !== 'refunded';

    const needsRefund = isCancelled || isOverdue;

    return {
        needsRefund: needsRefund,
        canRefund: isPaidOneTime && needsRefund,
        reason: isCancelled ? 'Cancelada' : (isOverdue ? 'No completada (vencida)' : '')
    };
}

// --- FUNCIONES PRINCIPALES ---
async function fetchAppointmentsData(user) {
    loadingIndicator.style.display = 'block';
    appointmentsTableBody.innerHTML = '';
    
    try {
        const idToken = await user.getIdToken(true);

        const response = await fetch(`${BACKEND_URL}/api/admin/appointments`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${idToken}`,
                "Content-Type": "application/json",
            },
        });

        const responseData = await response.json();

        if (!response.ok) {
            Swal.fire({
                icon: 'error',
                title: 'Error de Conexión',
                text: responseData.error || 'Error al obtener citas. Por favor, inténtelo de nuevo.',
            });
            throw new Error(responseData.error || 'Error al obtener citas');
        }

        allAppointments = responseData.appointments;
        renderAppointmentsTable(allAppointments);
        addDetailListeners();

    } catch (error) {
        console.error("Error fetching appointments:", error);
        appointmentsTableBody.innerHTML = `<tr><td colspan="7">Error al cargar las citas: ${error.message}</td></tr>`;
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

function renderAppointmentsTable(appointments) {
    appointmentsTableBody.innerHTML = ''; 
    
    if (appointments.length === 0) {
        appointmentsTableBody.innerHTML = '<tr><td colspan="7">No se encontraron citas.</td></tr>';
        return;
    }

    const formatter = new Intl.DateTimeFormat('es-ES', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

    appointments.forEach(appt => {
        const row = appointmentsTableBody.insertRow();
        let statusClass, statusText;

        switch (appt.status) {
            case 'pending': statusClass = 'status-default'; statusText = 'Pendiente'; break;
            case 'confirmed': statusClass = 'status-confirmed'; statusText = 'Confirmada'; break;
            case 'inProgress': statusClass = 'status-in-progress'; statusText = 'En Curso'; break;
            case 'completed': statusClass = 'status-completed'; statusText = 'Completada'; break;
            case 'rated': statusClass = 'status-rated'; statusText = 'Calificada'; break;
            case 'cancelled': statusClass = 'status-cancelled'; statusText = 'Cancelada'; break;
            case 'refunded': statusClass = 'status-refunded'; statusText = 'Reembolsada'; break;
            default: statusClass = 'status-default'; statusText = appt.status; 
        }

        const formattedDate = appt.scheduledDateTime ? formatter.format(new Date(appt.scheduledDateTime)) : 'Fecha N/A';
        const { typeText } = getPaymentInfo(appt.paymentType); 
        
        const { needsRefund } = checkRefundEligibility(appt);
        const refundIcon = needsRefund ? '<span class="refund-alert" title="Requiere Reembolso"> ⚠️</span>' : '';

        row.innerHTML = `
            <td>${appt.id.substring(0, 8)}...</td>
            <td>${formattedDate}</td>
            <td>${appt.psychologistName}</td>
            <td>${appt.patientName}</td>
            <td>${typeText}</td>
            <td><span class="status-pill ${statusClass}">${statusText}${refundIcon}</span></td>
            <td><button class="btn btn-secondary detail-btn" data-id="${appt.id}">Detalles</button></td>
        `;
    });
}

function addDetailListeners() {
    document.querySelectorAll('.detail-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const appointmentId = e.target.getAttribute('data-id');
            const appointment = allAppointments.find(a => a.id === appointmentId);
            if (appointment) {
                displayAppointmentDetails(appointment);
                detailsModal.showModal();
            }
        });
    });
}

statusFilter.addEventListener('change', () => {
    const filterValue = statusFilter.value;
    let filteredList = allAppointments;
    if (filterValue !== 'all') {
        filteredList = allAppointments.filter(appt => appt.status === filterValue);
    }
    renderAppointmentsTable(filteredList);
    addDetailListeners();
});

function displayAppointmentDetails(appt) {
    if (!detailsModal || !modalContent) return;

    const { needsRefund, canRefund, reason } = checkRefundEligibility(appt);
    const { typeText } = getPaymentInfo(appt.paymentType); 

    modalTitle.textContent = `Detalles de la Cita #${appt.id.substring(0, 8)}...`;
    
    let statusClass, statusText;
    switch (appt.status) {
        case 'pending': statusClass = 'status-default'; statusText = 'Pendiente'; break;
        case 'confirmed': statusClass = 'status-confirmed'; statusText = 'Confirmada'; break;
        case 'inProgress': statusClass = 'status-in-progress'; statusText = 'En Curso'; break;
        case 'completed': statusClass = 'status-completed'; statusText = 'Completada'; break;
        case 'rated': statusClass = 'status-rated'; statusText = 'Calificada'; break;
        case 'cancelled': statusClass = 'status-cancelled'; statusText = 'Cancelada'; break;
        case 'refunded': statusClass = 'status-refunded'; statusText = 'Reembolsada'; break;
        default: statusClass = 'status-default'; statusText = appt.status; 
    }

    document.getElementById('detail-id').textContent = appt.id;
    document.getElementById('detail-type').textContent = typeText; 
    
    const detailStatusSpan = document.getElementById('detail-status');
    detailStatusSpan.textContent = statusText;
    detailStatusSpan.className = `status-pill ${statusClass}`; 

    document.getElementById('detail-psycho-name').textContent = appt.psychologistName;
    document.getElementById('detail-psycho-email').textContent = appt.psychologistEmail; 

    document.getElementById('detail-patient-name').textContent = appt.patientName;
    document.getElementById('detail-patient-email').textContent = appt.patientEmail;

    document.getElementById('detail-notes').textContent = appt.notes || 'No hay notas registradas.';
    
    const extendedFormatter = new Intl.DateTimeFormat('es-ES', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
    const formattedDate = appt.scheduledDateTime ? extendedFormatter.format(new Date(appt.scheduledDateTime)) : 'Fecha N/A';
    document.getElementById('detail-datetime').textContent = formattedDate;

    if (dynamicContentArea) dynamicContentArea.innerHTML = ''; 

    // 🆕 Mostrar fecha de creación
    if (appt.createdAt) {
        const createdDate = new Intl.DateTimeFormat('es-ES', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }).format(new Date(appt.createdAt));
        
        dynamicContentArea.innerHTML += `
            <div class="detail-group">
                <label>Fecha de Creación:</label>
                <span>${createdDate}</span>
            </div>
        `;
    }

    // 🆕 Mostrar razón de cancelación
    if (appt.status === 'cancelled' && appt.cancellationReason) {
        dynamicContentArea.innerHTML += `
            <div class="detail-group">
                <label>Razón de Cancelación:</label>
                <span style="color: #dc3545; font-weight: 600;">${appt.cancellationReason}</span>
            </div>
        `;
        
        if (appt.cancelledAt) {
            const cancelDate = new Intl.DateTimeFormat('es-ES', {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            }).format(new Date(appt.cancelledAt));
            
            dynamicContentArea.innerHTML += `
                <div class="detail-group">
                    <label>Fecha de Cancelación:</label>
                    <span>${cancelDate}</span>
                </div>
            `;
        }
    }

    // 🆕 Alerta de reembolso mejorada
    if (needsRefund && appt.status !== 'refunded') {
        dynamicContentArea.innerHTML += `
            <p class="refund-warning">
                ⚠️ <strong>Esta cita requiere reembolso</strong><br>
                Razón: ${reason}<br>
                Tipo de pago: ${typeText}<br>
                Estado: ${appt.isPaid ? 'Pagada ✓' : 'No Pagada ✗'}
            </p>
        `;
    }

    if (canRefund) {
        dynamicContentArea.innerHTML += `
            <div class="modal-actions mt-30">
                <button id="refund-btn" class="action-btn primary">Procesar Reembolso</button>
            </div>
        `;

        document.getElementById('refund-btn').addEventListener('click', () => {
            initiateRefund(appt.id, appt.paymentIntentId); 
        });
    }

    const ratingGroup = document.getElementById('detail-rating-group');
    if (appt.rating) {
        ratingGroup.style.display = 'flex';
        document.getElementById('detail-rating').textContent = `${appt.rating} Estrellas`; 
    } else {
        ratingGroup.style.display = 'none';
    }
}

async function initiateRefund(appointmentId, paymentIntentId) {
    if (!paymentIntentId) {
        // 🔧 CERRAR modal ANTES de mostrar SweetAlert
        detailsModal.close();
        
        await Swal.fire({
            icon: 'warning',
            title: 'Sin Pago',
            text: 'Esta cita no tiene un ID de intención de pago para procesar un reembolso.',
        });
        return;
    }
    
    // 🔧 CERRAR modal ANTES de mostrar confirmación
    detailsModal.close();
    
    const result = await Swal.fire({
        title: '¿Confirmar Reembolso?',
        text: "Estás a punto de procesar un reembolso para esta cita. Esta acción no se puede deshacer.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, ¡Reembolsar!',
        cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) {
        // 🔧 Si cancela, volver a abrir el modal
        detailsModal.showModal();
        return;
    }
    
    Swal.fire({
        title: 'Procesando Reembolso...',
        text: 'Por favor, espera. Esto puede tardar unos segundos.',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        const idToken = await currentUser.getIdToken(true);
        const response = await fetch(`${BACKEND_URL}/api/admin/stripe/refund-session`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${idToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ sessionId: appointmentId, paymentIntentId })
        });

        const responseData = await response.json();
        Swal.close();

        if (!response.ok) {
            Swal.fire({
                icon: 'error',
                title: 'Fallo en el Reembolso',
                text: responseData.error || `Error: ${responseData.details || 'Error desconocido al procesar el reembolso.'}`,
            });
            throw new Error(responseData.error || 'Error al procesar el reembolso');
        }

        await Swal.fire({
            icon: 'success',
            title: '¡Reembolso Exitoso!',
            html: `
                <p>Se ha procesado el reembolso correctamente.</p>
                <p><strong>ID de Reembolso:</strong> ${responseData.refundId}</p>
                <hr>
                <p style="color: #28a745; font-weight: 600;">
                    Stripe enviará automáticamente un recibo al cliente
                </p>
            `,
        });
        
        fetchAppointmentsData(currentUser); 

    } catch (error) {
        console.error("Error al iniciar el reembolso:", error);
        if (Swal.isVisible()) {
             Swal.fire({
                icon: 'error',
                title: 'Error de Conexión',
                text: 'No se pudo contactar al servidor o hubo un error al procesar el reembolso.',
            });
        }
    }
}

window.logout = async () => {
  try {
    await signOut(auth);
    localStorage.removeItem("firebaseIdToken");
    localStorage.removeItem("adminData");
    window.location.href = "loginAdmin.html";
  } catch (error) {
    console.error("Error en logout:", error);
    Swal.fire({
        icon: 'error',
        title: 'Error de Logout',
        text: 'No se pudo cerrar la sesión correctamente. Intenta de nuevo.',
    });
  }
};
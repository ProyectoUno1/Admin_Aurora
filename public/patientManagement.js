// frontend/patientManagement.js

import { auth, BACKEND_URL } from "./firebase-config.js"; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const patientsTableBody = document.getElementById('patientsTableBody');
const loadingIndicator = document.getElementById('loading-patients');
const subscriptionFilter = document.getElementById('filter-subscription');

// --- DECLARACIONES PARA EL MODAL DE DETALLES/EDICIÓN ---
const patientDetailsModal = document.getElementById('patientDetailsModal');
const modalSaveBtn = document.getElementById('modal-save-btn');
const modalDeleteBtn = document.getElementById('modal-delete-btn');
// const modalMessage = document.getElementById('modal-edit-message'); // ELIMINADO
let pendingUpdates = {}; // Objeto para rastrear los cambios a enviar

const modalElements = patientDetailsModal ? {
    closeButton: patientDetailsModal.querySelector('.close-button'),
    uid: document.getElementById('modal-uid'),
    titleUsername: document.getElementById('modal-title-username'),
    username: document.getElementById('modal-username'),
    email: document.getElementById('modal-email'),
    phone: document.getElementById('modal-phone'),
    created: document.getElementById('modal-created'),
    premium: document.getElementById('modal-premium')
} : null;

let allPatients = []; 

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "loginAdmin.html";
        return;
    }
    
    fetchPatientsData(user);
    document.getElementById("userEmail").textContent = user.email;

    // Agregar Listener de Eventos al cuerpo de la tabla (Delegación)
    patientsTableBody.addEventListener('click', handlePatientActions);
    
    // --- LÓGICA DE CIERRE Y ACCIONES DEL MODAL ---
    if (modalElements) {
        modalElements.closeButton.addEventListener('click', () => {
            patientDetailsModal.style.display = 'none';
        });

        modalSaveBtn.addEventListener('click', () => handleModalSave(user));
        modalDeleteBtn.addEventListener('click', () => deletePatient(modalElements.uid.value, user));

        // Manejar clics de edición en el modal (delegación)
        patientDetailsModal.addEventListener('click', (e) => handleInlineEdit(e, user));
    }
    
    // Cierra el modal si el usuario hace clic fuera de él
    window.addEventListener('click', (event) => {
        if (event.target === patientDetailsModal) {
            patientDetailsModal.style.display = 'none';
        }
    });
});

async function fetchPatientsData(user) {
    loadingIndicator.style.display = 'block';
    patientsTableBody.innerHTML = '';
    
    try {
        const idToken = await user.getIdToken(true);

        const response = await fetch(`${BACKEND_URL}/api/admin/patients`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${idToken}`,
                "Content-Type": "application/json",
            },
        });

        const responseData = await response.json();

        if (!response.ok) {
            throw new Error(responseData.error || 'Error al obtener pacientes');
        }

        allPatients = responseData.patients;
        renderPatientsTable(allPatients);

    } catch (error) {
        console.error("Error al cargar pacientes:", error);
        patientsTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Error al cargar los datos: ${error.message}</td></tr>`;
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

// Función para renderizar la tabla
function renderPatientsTable(patientsToRender) {
    patientsTableBody.innerHTML = ''; 

    if (patientsToRender.length === 0) {
        patientsTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">No se encontraron pacientes que cumplan el criterio de filtro.</td></tr>`;
        return;
    }

    patientsToRender.forEach(patient => {
        const row = patientsTableBody.insertRow();
        row.dataset.uid = patient.uid; 
        const subscriptionText = patient.isPremium ? 'Suscrito' : 'No Suscrito';
        const subscriptionClass = patient.isPremium ? 'status-subscribed' : 'status-unsubscribed';

        row.innerHTML = `
            <td>${patient.uid.substring(0, 8)}...</td>
            <td>${patient.username}</td>
            <td>${patient.email}</td>
            <td>${patient.phone_number}</td>
            <td>${patient.created_at}</td>
            <td><span class="${subscriptionClass}">${subscriptionText}</span></td>
            <td>
                <button class="btn btn-secondary action-view" data-uid="${patient.uid}">Ver</button>
                <button class="btn btn-info action-edit" data-uid="${patient.uid}">Editar</button>
                <button class="btn btn-danger action-delete" data-uid="${patient.uid}">Borrar</button>
            </td>
        `;
    });
}

// Función delegada para manejar las acciones (Ver, Editar, Borrar)
function handlePatientActions(event) {
    const target = event.target;
    if (target.tagName !== 'BUTTON') return; 

    const uid = target.dataset.uid;
    const user = auth.currentUser;

    if (!uid || !user) {
        console.error('UID o usuario no disponible.');
        return;
    }
    
    // Tanto 'Ver' como 'Editar' ahora abren el mismo modal interactivo.
    if (target.classList.contains('action-view') || target.classList.contains('action-edit')) {
        viewOrEditPatientDetails(uid, user);
    } else if (target.classList.contains('action-delete')) {
        deletePatient(uid, user);
    }
}


// Lógica para FILTRAR
subscriptionFilter.addEventListener('change', () => {
    const filterValue = subscriptionFilter.value;

    let filteredList = allPatients;

    if (filterValue === 'subscribed') {
        filteredList = allPatients.filter(p => p.isPremium === true);
    } else if (filterValue === 'unsubscribed') {
        filteredList = allPatients.filter(p => p.isPremium === false);
    }
    
    renderPatientsTable(filteredList);
});

// --- FUNCIONES DE ACCIÓN ---

// 1. CARGAR DETALLES EN MODAL (Única función para ver/editar)
async function viewOrEditPatientDetails(uid, user) {
    if (!patientDetailsModal || !modalElements) return;

    // Reiniciar el estado del modal
    pendingUpdates = {};
    modalSaveBtn.disabled = true;
    
    // Ocultar cualquier input de edición abierto previamente
    patientDetailsModal.querySelectorAll('.editable-input, .editable-select').forEach(el => {
        const valueContainer = el.closest('.detail-value-container');
        if (valueContainer) {
            valueContainer.querySelector('.detail-value').style.display = 'inline';
            valueContainer.querySelector('.btn-edit-inline').style.display = 'inline';
        }
        el.remove();
    });

    try {
        const idToken = await user.getIdToken(true);
        const response = await fetch(`${BACKEND_URL}/api/admin/patients/${uid}`, {
            headers: { Authorization: `Bearer ${idToken}` },
        });
        
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error al obtener detalles');
        }

        const patient = data.patient;
        
        // Inyectar datos en el modal
        modalElements.uid.value = patient.uid;
        modalElements.titleUsername.textContent = patient.username;
        
        modalElements.username.textContent = patient.username;
        modalElements.username.dataset.original = patient.username;

        modalElements.email.textContent = patient.email; // No editable
        
        modalElements.phone.textContent = patient.phone_number;
        modalElements.phone.dataset.original = patient.phone_number;
        
        const premiumText = patient.isPremium ? 'Suscrito (Premium)' : 'No Suscrito';
        modalElements.premium.textContent = premiumText;
        modalElements.premium.dataset.originalBool = patient.isPremium.toString();
        modalElements.premium.className = patient.isPremium ? 'detail-value status-subscribed' : 'detail-value status-unsubscribed';
        
        modalElements.created.textContent = patient.created_at; // No editable

        // Mostrar el modal
        patientDetailsModal.style.display = 'block';

    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error de Carga',
            text: `Error al cargar los detalles: ${error.message}`,
        });
        console.error(error);
    }
}

// 2. MANEJO DE EDICIÓN EN LÍNEA (al hacer clic en el lápiz)
function handleInlineEdit(event, user) {
    const target = event.target.closest('.btn-edit-inline');
    if (!target) return;
    
    const field = target.dataset.field;
    const detailRow = target.closest('.detail-row');
    const valueSpan = detailRow.querySelector('.detail-value');
    const valueContainer = detailRow.querySelector('.detail-value-container');
    
    // 1. Ocultar el span de valor y el botón de lápiz
    valueSpan.style.display = 'none';
    target.style.display = 'none';

    let inputElement;
    let originalValue;

    if (field === 'isPremium') {
        // Campo de selección (Select)
        originalValue = valueSpan.dataset.originalBool;
        inputElement = document.createElement('select');
        inputElement.classList.add('editable-select');
        inputElement.innerHTML = `
            <option value="true">Suscrito (Premium)</option>
            <option value="false">No Suscrito</option>
        `;
        inputElement.value = originalValue;
    } else {
        // Campo de texto (Username, Phone)
        originalValue = valueSpan.dataset.original;
        inputElement = document.createElement('input');
        inputElement.type = 'text';
        inputElement.classList.add('editable-input');
        inputElement.value = originalValue === 'N/A' ? '' : originalValue;
    }

    // 2. Insertar el nuevo input/select
    valueContainer.insertBefore(inputElement, target);
    inputElement.focus();
    
    // 3. Manejar la actualización al cambiar/perder el foco
    const handleUpdate = () => {
        const newValue = inputElement.value;
        let isChanged = false;

        if (field === 'isPremium') {
            isChanged = newValue !== originalValue;
            valueSpan.textContent = newValue === 'true' ? 'Suscrito (Premium)' : 'No Suscrito';
            valueSpan.className = newValue === 'true' ? 'detail-value status-subscribed' : 'detail-value status-unsubscribed';
        } else { // username, phone_number
            // El backend maneja 'N/A' para el front, enviamos cadena vacía o valor real
            const cleanNewValue = newValue.trim();
            const cleanOriginalValue = originalValue === 'N/A' ? '' : originalValue;

            if (cleanNewValue !== cleanOriginalValue) {
                isChanged = true;
                // Actualizar el valor mostrado en el span
                valueSpan.textContent = cleanNewValue === '' ? 'N/A' : cleanNewValue; 
            } else {
                valueSpan.textContent = originalValue; // Mantener el valor original si no hubo cambio real
            }
        }
        
        // Registrar o eliminar la actualización pendiente
        if (isChanged) {
            // Manejo especial para el backend: si el teléfono está vacío, enviar null para limpiar.
            pendingUpdates[field] = (field === 'phone_number' && newValue.trim() === '') ? null : newValue; 
        } else {
            delete pendingUpdates[field];
        }

        // 4. Limpiar y restaurar la vista
        inputElement.remove();
        valueSpan.style.display = 'inline';
        target.style.display = 'inline';
        
        // Habilitar todos los lápices de nuevo (SweetAlert ya maneja la carga)
        patientDetailsModal.querySelectorAll('.btn-edit-inline').forEach(btn => btn.disabled = false);


        // 5. Habilitar o deshabilitar el botón de guardar
        modalSaveBtn.disabled = Object.keys(pendingUpdates).length === 0;
    };

    // Escuchar el cambio o la pérdida de foco para guardar/restaurar
    inputElement.addEventListener('change', handleUpdate);
    // Usar 'blur' para detectar clics fuera del campo
    inputElement.addEventListener('blur', handleUpdate);
    
    // Deshabilitar todos los lápices mientras se edita para evitar conflictos
    patientDetailsModal.querySelectorAll('.btn-edit-inline').forEach(btn => btn.disabled = true);
    target.disabled = true; // El lápiz actual debe estar deshabilitado
}


// 3. MANEJO DEL BOTÓN DE GUARDAR
async function handleModalSave(user) {
    const uid = modalElements.uid.value;
    const updates = { ...pendingUpdates }; // Copia de los cambios pendientes

    if (Object.keys(updates).length === 0) {
        await Swal.fire({
            icon: 'info',
            title: 'Sin Cambios',
            text: 'No hay campos modificados para guardar.',
            timer: 3000
        });
        return;
    }
  
    Swal.fire({
        title: 'Guardando Cambios...',
        text: 'Por favor, espera.',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const idToken = await user.getIdToken(true);
        
        const response = await fetch(`${BACKEND_URL}/api/admin/patients/${uid}`, {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${idToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(updates),
        });

        const responseData = await response.json();

        if (!response.ok) {
            Swal.close(); // Cerrar carga antes de error
            throw new Error(responseData.error || 'Error al actualizar');
        }

        Swal.close();
        Swal.fire({
            icon: 'success',
            title: '¡Guardado!',
            text: 'Los datos del paciente han sido actualizados con éxito.',
        });
        
        // Si el nombre de usuario cambió, actualizar el título del modal
        if (updates.username) {
            modalElements.titleUsername.textContent = updates.username;
        }

        // Reiniciar el estado de edición y recargar la tabla de fondo
        pendingUpdates = {};
        modalSaveBtn.disabled = true;
        fetchPatientsData(user); 

    } catch (error) {
        console.error("Error al guardar paciente:", error);
        if (Swal.isVisible()) Swal.close();
        Swal.fire({
            icon: 'error',
            title: 'Error al Guardar',
            text: `Error: ${error.message}`,
        });
        modalSaveBtn.disabled = false;
    }
}


// 4. ELIMINAR PACIENTE
async function deletePatient(uid, user) {
    const patientToDelete = allPatients.find(p => p.uid === uid);

    if (!patientToDelete) return;

    // 1. Confirmación SweetAlert
    const result = await Swal.fire({
        title: '¿Estás seguro de ELIMINAR al paciente? 🗑️',
        text: `Estás a punto de ELIMINAR al paciente ${patientToDelete.username} con UID ${uid.substring(0, 8)}... Esta acción es irreversible y eliminará el usuario y sus datos.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, ¡eliminar paciente!',
        cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) {
        return;
    }

    Swal.fire({
        title: 'Eliminando Paciente...',
        text: 'Por favor, espera.',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const idToken = await user.getIdToken(true);

        const response = await fetch(`${BACKEND_URL}/api/admin/patients/${uid}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${idToken}`,
            },
        });

        if (!response.ok) {
            Swal.close(); 
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al eliminar');
        }

        // 2. SweetAlert (Éxito)
        Swal.close();
        await Swal.fire({
            title: '¡Eliminación Exitosa!',
            text: 'Paciente eliminado con éxito. Recargando datos...',
            icon: 'success',
            confirmButtonColor: '#106f8c',
        });

        patientDetailsModal.style.display = 'none'; // Cerrar el modal
        fetchPatientsData(user); // Recargar la tabla

    } catch (error) {
        console.error("Error al eliminar el paciente:", error);
        
        // 3. SweetAlert (Error)
        if (Swal.isVisible()) Swal.close();
        Swal.fire({
            title: 'Fallo al Eliminar',
            text: `Ha ocurrido un error: ${error.message}`,
            icon: 'error',
            confirmButtonColor: '#106f8c',
        });
    }
}
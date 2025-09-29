import { auth, BACKEND_URL } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

let currentPsychologists = [];
let filteredPsychologists = [];
let currentPsychologistId = null;

// Mapeo de estados del backend a texto y clase CSS para el frontend
const statusMap = {
  PENDING: { text: 'Pendiente', colorClass: 'status-pendiente' },
  APPROVED: { text: 'Activo', colorClass: 'status-activo' }, 
  ACTIVE: { text: 'Activo', colorClass: 'status-activo' }, 
  REJECTED: { text: 'Rechazado', colorClass: 'status-rechazado' },
  INACTIVE: { text: 'Inactivo', colorClass: 'status-inactivo' },
  DEFAULT: { text: 'Desconocido', colorClass: 'status-unknown' } 
};

// Verificar autenticación al cargar la página
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'loginAdmin.html';
    return;
  }

  try {
    const idToken = await user.getIdToken();
    
    // Verificar privilegios de admin
    const response = await fetch(`${BACKEND_URL}/api/login/profile`, {
      headers: {
        'Authorization': `Bearer ${idToken}`
      }
    });

    if (!response.ok) {
      throw new Error('No es administrador');
    }

    const adminData = await response.json();
    document.getElementById('userEmail').textContent = adminData.email;
    
    // Cargar datos
    await loadStats();
    await loadPsychologists();
    
  } catch (error) {
    console.error('Error verificando admin:', error);
    alert('Error: No tienes privilegios de administrador');
    window.location.href = 'loginAdmin.html';
  }
});

// Cargar estadísticas
async function loadStats() {
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
      document.getElementById('rejectedPsychologists').textContent = stats.rejected || 0;
    }
  } catch (error) {
    console.error('Error cargando estadísticas:', error);
  }
}

// Cargar lista de psicólogos
async function loadPsychologists() {
  try {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('psychologistGrid').style.display = 'none';
    document.getElementById('noResults').style.display = 'none';

    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`${BACKEND_URL}/api/psychologists`, {
      headers: {
        'Authorization': `Bearer ${idToken}`
      }
    });

    if (response.ok) {
      currentPsychologists = await response.json();
      filteredPsychologists = [...currentPsychologists];
      renderPsychologists();
    } else {
      throw new Error('Error cargando psicólogos');
    }
  } catch (error) {
    console.error('Error cargando psicólogos:', error);
    alert('Error cargando la lista de psicólogos');
  } finally {
    document.getElementById('loading').style.display = 'none';
  }
}

// Mapear datos del psicólogo para manejar diferentes nombres de campos
function mapPsychologistData(psychologist) {
  return {
    id: psychologist.id,
    fullName: psychologist.fullName || psychologist.name || psychologist.displayName || 'Sin nombre',
    email: psychologist.email || 'No especificado',
    specialty: psychologist.specialty || psychologist.speciality || 'No especificada',
    professionalLicense: psychologist.professionalLicense || psychologist.license || psychologist.cedula || 'No registrada',
    yearsExperience: psychologist.yearsExperience || psychologist.experience || 0,
    education: psychologist.education || [],
    status: psychologist.status || 'PENDING', 
    description: psychologist.description || psychologist.bio || '',
    photoUrl: psychologist.photoUrl || psychologist.profileImage || psychologist.avatar || '',
    adminNotes: psychologist.adminNotes || '',
    validatedAt: psychologist.validatedAt || '',
    lastUpdated: psychologist.lastUpdated || '',
    adminUid: psychologist.adminUid || '',
    price: psychologist.price || psychologist.sessionPrice || 0,
  };
}

// Renderizar lista de psicólogos
function renderPsychologists() {
  const grid = document.getElementById('psychologistGrid');
  const noResults = document.getElementById('noResults');

  if (filteredPsychologists.length === 0) {
    grid.style.display = 'none';
    noResults.style.display = 'block';
    return;
  }

  grid.style.display = 'grid';
  noResults.style.display = 'none';

  grid.innerHTML = filteredPsychologists.map(psychologistRaw => {
    const psychologist = mapPsychologistData(psychologistRaw);
    
    // Obtener la información del estado del mapa
    const statusInfo = statusMap[psychologist.status] || statusMap.DEFAULT;

    const photoUrl = psychologist.photoUrl || 'https://via.placeholder.com/60x60?text=P';
    
    // Condición para mostrar botones de acción
    const showActions = psychologist.status === 'PENDING';

    return `
      <div class="psychologist-card">
        <div class="psychologist-header">
          <img src="${photoUrl}" alt="Avatar" class="psychologist-avatar" onerror="this.src='https://via.placeholder.com/60x60?text=P'">
          <div class="psychologist-info">
            <h3>${psychologist.fullName}</h3>
            <div class="psychologist-specialty">${psychologist.specialty}</div>
          </div>
        </div>
        <div class="status-badge ${statusInfo.colorClass}">
          ${statusInfo.text}
        </div>
        <div class="psychologist-details">
          <div><strong>Cédula:</strong> ${psychologist.professionalLicense}</div>
          <div><strong>Experiencia:</strong> ${psychologist.yearsExperience || 0} años</div>
          <div><strong>Educación:</strong> ${getEducationText(psychologist.education)}</div>
        </div>
        <div class="card-actions">
          <button class="btn btn-details" onclick="showPsychologistDetails('${psychologist.id}')">
            Ver Detalles
          </button>
          ${showActions ? `
            <button class="btn btn-validate" onclick="updatePsychologistStatus('${psychologist.id}', 'ACTIVE', 'Cédula validada correctamente')">
              Validar
            </button>
            <button class="btn btn-reject" onclick="showRejectionModalForId('${psychologist.id}')">
              Rechazar
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Extraer texto de educación
function getEducationText(education) {
  if (!education) return 'No especificada';
  if (Array.isArray(education) && education.length > 0) {
    const first = education[0];
    if (typeof first === 'object' && first.institution) {
      return first.institution;
    } else if (typeof first === 'string') {
      return first;
    }
  }
  return 'No especificada';
}

// Función para mostrar el modal de detalles del psicólogo
async function showPsychologistDetails(psychologistId) {
  try {
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`${BACKEND_URL}/api/psychologists/${psychologistId}`, {
      headers: {
        'Authorization': `Bearer ${idToken}`
      }
    });

    if (!response.ok) {
      throw new Error('No se pudo cargar la información del psicólogo.');
    }

    const psychologist = await response.json();
    currentPsychologistId = psychologist.id;
    
    // Obtener la información del estado del mapa para el modal
    const statusInfo = statusMap[psychologist.status] || statusMap.DEFAULT;

    // Actualizar el título del modal y los campos de datos
    document.getElementById('modalTitle').textContent = `Detalles de ${psychologist.fullName || 'Psicólogo'}`;

    // Llenar campos de información del modal
    document.getElementById('modalFullName').textContent = psychologist.fullName || 'No especificado';
    document.getElementById('modalEmail').textContent = psychologist.email || 'No especificado';
    document.getElementById('modalStatus').textContent = statusInfo.text;
    document.getElementById('modalAdminNotes').textContent = psychologist.adminNotes || 'N/A';
    document.getElementById('modalProfessionalTitle').textContent = psychologist.professionalTitle || 'No especificado';
    document.getElementById('modalProfessionalLicense').textContent = psychologist.professionalLicense || 'No especificado';
    document.getElementById('modalYearsExperience').textContent = psychologist.yearsExperience ? `${psychologist.yearsExperience} años` : 'No especificado';
    document.getElementById('modalSpecialty').textContent = psychologist.specialty || 'No especificado';
    document.getElementById('modalDescription').textContent = psychologist.description || 'No especificado';
    document.getElementById('modalIsAvailable').textContent = psychologist.isAvailable ? 'Sí' : 'No';
    document.getElementById('modalPrice').textContent = psychologist.price ? `$${psychologist.price}` : 'No especificado';
    
    const educationList = document.getElementById('modalEducationList');
    educationList.innerHTML = psychologist.education?.length ? psychologist.education.map(edu => `<li>${edu.institution || edu}</li>`).join('') : '<li>No especificado</li>';
    const certificationsList = document.getElementById('modalCertificationsList');
    certificationsList.innerHTML = psychologist.certifications?.length ? psychologist.certifications.map(cert => `<li>${cert}</li>`).join('') : '<li>No especificado</li>';
    const scheduleList = document.getElementById('modalScheduleList');
    scheduleList.innerHTML = psychologist.schedule ? Object.entries(psychologist.schedule).filter(([, val]) => val.available).map(([day, val]) => `<li>${day}: ${val.startTime} - ${val.endTime}</li>`).join('') : '<li>Horario no especificado</li>';

    // Configurar la edición del precio
    setupPriceEditing(psychologist);

    // Configuración dinámica de botones en el modal
    const validateBtn = document.getElementById('validateBtn');
    const rejectBtn = document.getElementById('rejectBtn');
    const deleteBtn = document.getElementById('deleteBtn');

    // Limpiar event listeners anteriores para evitar múltiples llamadas
    validateBtn.onclick = null;
    rejectBtn.onclick = null;
    deleteBtn.onclick = null;
    
    // Configurar botones según el estado actual del psicólogo (usando los estados del backend)
    if (psychologist.status === 'ACTIVE') {
        validateBtn.style.display = 'none';
        rejectBtn.style.display = 'block';
        deleteBtn.style.display = 'none';
        rejectBtn.onclick = () => showRejectionModalForId(psychologist.id);
    } else if (psychologist.status === 'REJECTED' || psychologist.status === 'INACTIVE') {
        validateBtn.style.display = 'block';
        rejectBtn.style.display = 'none';
        deleteBtn.style.display = 'block';
        validateBtn.onclick = () => updatePsychologistStatus(psychologist.id, 'ACTIVE', 'Cédula validada correctamente');
        deleteBtn.onclick = () => deletePsychologist(psychologist.id);
    } else { // PENDING
        validateBtn.style.display = 'block';
        rejectBtn.style.display = 'block';
        deleteBtn.style.display = 'none';
        validateBtn.onclick = () => updatePsychologistStatus(psychologist.id, 'ACTIVE', 'Cédula validada correctamente');
        rejectBtn.onclick = () => showRejectionModalForId(psychologist.id);
    }
    
    document.getElementById('psychologistModal').style.display = 'block';

  } catch (error) {
    console.error('Error al mostrar los detalles:', error);
    alert(error.message);
  }
}

// Función para configurar la edición del precio
function setupPriceEditing(psychologist) {
  const editPriceBtn = document.getElementById('editPriceBtn');
  const priceEditSection = document.getElementById('priceEditSection');
  const priceInput = document.getElementById('priceInput');
  const savePriceBtn = document.getElementById('savePriceBtn');
  const cancelPriceBtn = document.getElementById('cancelPriceBtn');
  
  // Limpiar event listeners anteriores
  editPriceBtn.onclick = null;
  savePriceBtn.onclick = null;
  cancelPriceBtn.onclick = null;
  
  // Mostrar/ocultar sección de edición
  editPriceBtn.onclick = () => {
    priceInput.value = psychologist.price || '';
    priceEditSection.style.display = 'block';
    editPriceBtn.style.display = 'none';
  };
  
  cancelPriceBtn.onclick = () => {
    priceEditSection.style.display = 'none';
    editPriceBtn.style.display = 'inline-block';
    priceInput.value = psychologist.price || '';
  };
  
  savePriceBtn.onclick = async () => {
    const newPrice = parseFloat(priceInput.value);
    
    if (isNaN(newPrice) || newPrice < 0) {
      alert('Por favor ingresa un precio válido (número mayor o igual a 0)');
      return;
    }
    
    try {
      await updatePsychologistPrice(psychologist.id, newPrice);
      priceEditSection.style.display = 'none';
      editPriceBtn.style.display = 'inline-block';
      
      // Actualizar el precio mostrado
      document.getElementById('modalPrice').textContent = `$${newPrice}`;
      
      // Actualizar el objeto psychologist localmente
      psychologist.price = newPrice;
      
      alert('Precio actualizado correctamente');
    } catch (error) {
      alert('Error al actualizar el precio: ' + error.message);
    }
  };
}

// Función para actualizar el precio del psicólogo
async function updatePsychologistPrice(psychologistId, price) {
  const idToken = await auth.currentUser.getIdToken();
  const response = await fetch(`${BACKEND_URL}/api/psychologists/${psychologistId}/price`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({ price })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Error al actualizar el precio');
  }
  
  return await response.json();
}

// Función para cerrar el modal de detalles principal
function closeModal() {
  document.getElementById('psychologistModal').style.display = 'none';
  currentPsychologistId = null; // Limpiar ID al cerrar
}

function showRejectionModal() {
  document.getElementById('rejectionModal').style.display = 'block';
  document.getElementById('rejectionReasonInput').value = ''; // Limpiar campo
}

function closeRejectionModal() {
  document.getElementById('rejectionModal').style.display = 'none';
}

function showRejectionModalForId(id) {
  currentPsychologistId = id;
  showRejectionModal();
}

// Función para actualizar el estado del psicólogo
async function updatePsychologistStatus(psychologistId, status, adminNotes) {
  if (status === 'REJECTED' && !adminNotes.trim()) {
    alert('Por favor, ingresa una razón para rechazar al psicólogo.');
    return;
  }
  
  const statusText = statusMap[status]?.text || statusMap.DEFAULT.text;
  if (!confirm(`¿Estás seguro de que quieres cambiar el estado a '${statusText}'?`)) {
    return;
  }
  
  try {
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`${BACKEND_URL}/api/psychologists/${psychologistId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({ status, adminNotes })
    });

    if (response.ok) {
      alert(`Estado del psicólogo actualizado a ${statusText}.`);
      closeModal(); // Cierra el modal de detalles
      closeRejectionModal(); // Cierra el modal de rechazo, por si estuviera abierto
      await loadPsychologists(); // Recargar la lista
      await loadStats(); // Recargar las estadísticas
    } else {
      const errorData = await response.json();
      throw new Error(errorData.error || `Error al actualizar el estado. Código: ${response.status}`);
    }
  } catch (error) {
    console.error('Error al actualizar el estado:', error);
    alert('Hubo un problema al actualizar el estado: ' + error.message);
  }
}

// Función para eliminar un psicólogo
async function deletePsychologist(psychologistId) {
    if (!confirm('¿Estás seguro de que quieres eliminar este psicólogo permanentemente? Esta acción es irreversible.')) {
        return;
    }

    try {
        const idToken = await auth.currentUser.getIdToken();
        const response = await fetch(`${BACKEND_URL}/api/psychologists/${psychologistId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${idToken}`
            }
        });

        if (response.ok) {
            alert('Psicólogo eliminado correctamente.');
            closeModal();
            await loadPsychologists();
            await loadStats();
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al eliminar el psicólogo.');
        }
    } catch (error) {
        console.error('Error al eliminar psicólogo:', error);
        alert('Hubo un problema al eliminar el psicólogo: ' + error.message);
    }
}

// Función para aplicar filtros
function applyFilters() {
  const searchQuery = document.getElementById('searchBar').value.toLowerCase();
  const statusFilter = document.getElementById('statusFilter').value.toLowerCase(); 

  filteredPsychologists = currentPsychologists.filter(psychologist => {
    const matchesSearch = psychologist.fullName?.toLowerCase().includes(searchQuery);
    const matchesStatus = !statusFilter || (psychologist.status?.toLowerCase() === statusFilter);
    return matchesSearch && matchesStatus;
  });

  renderPsychologists();
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('searchBar').addEventListener('input', applyFilters);
  document.getElementById('statusFilter').addEventListener('change', applyFilters);
  
  // Modal de detalles principal
  const modal = document.getElementById('psychologistModal');
  const closeBtn = document.querySelector('.close');
  const closeDetailsBtn = document.getElementById('closeBtn');
  
  // Modal de rechazo
  const rejectionModal = document.getElementById('rejectionModal');
  const closeRejectionBtn = document.getElementById('closeRejectionModal');
  const confirmRejectBtn = document.getElementById('confirmRejectBtn');
  const cancelRejectBtn = document.getElementById('cancelRejectBtn');
  
  // Listeners para el modal principal
  closeBtn.addEventListener('click', closeModal);
  closeDetailsBtn.addEventListener('click', closeModal);

  window.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  // Listeners para el modal de rechazo
  closeRejectionBtn.addEventListener('click', closeRejectionModal);
  cancelRejectBtn.addEventListener('click', closeRejectionModal);
  
  // Listener para el botón de confirmación de rechazo
  confirmRejectBtn.addEventListener('click', () => {
    const reason = document.getElementById('rejectionReasonInput').value;
    updatePsychologistStatus(currentPsychologistId, 'REJECTED', reason); 
  });
});

// Funciones globales
window.showPsychologistDetails = showPsychologistDetails;
window.updatePsychologistStatus = updatePsychologistStatus;
window.closeModal = closeModal;
window.showRejectionModalForId = showRejectionModalForId;
window.deletePsychologist = deletePsychologist;
window.updatePsychologistPrice = updatePsychologistPrice;

// Función global para logout
window.logout = async () => {
  try {
    await signOut(auth);
    localStorage.removeItem('firebaseIdToken');
    localStorage.removeItem('adminData');
    window.location.href = 'loginAdmin.html';
  } catch (error) {
    console.error('Error en logout:', error);
  }
};
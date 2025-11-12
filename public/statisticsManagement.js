import { auth, BACKEND_URL } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

let psychologistsChartInstance = null;
let patientsChartInstance = null;
let appointmentsChartInstance = null;
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'loginAdmin.html';
    return;
  }

  try {
    const idToken = await user.getIdToken();

    // Verificar privilegios de admin y cargar datos básicos
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

    // Cargar las gráficas
    await loadCharts();

  } catch (error) {
    console.error('Error verificando admin:', error);
    await Swal.fire({
      icon: 'error',
      title: 'Acceso Denegado',
      text: 'Error: No tienes privilegios de administrador o la sesión expiró.',
      confirmButtonColor: '#106f8c',
    });
    window.location.href = 'loginAdmin.html';
  }
});

window.logout = async () => {
  try {
    await signOut(auth);
    window.location.href = 'loginAdmin.html';
  } catch (error) {
    console.error('Error en logout:', error);
  }
};


async function loadCharts() {
  document.getElementById('loading').style.display = 'block';
  const user = auth.currentUser;
  if (!user) {
      document.getElementById('loading').style.display = 'none';
      return;
  }

  try {
    const idToken = await user.getIdToken();
    const headers = { 'Authorization': `Bearer ${idToken}` };

    const [psyResponse, patResponse, apptResponse] = await Promise.all([
      fetch(`${BACKEND_URL}/api/stats/psychologists/history`, { headers }),
      fetch(`${BACKEND_URL}/api/stats/patients/history`, { headers }),
      fetch(`${BACKEND_URL}/api/stats/appointments/history`, { headers })
    ]);

    // 1. Gráfica de Psicólogos
    if (psyResponse.ok) {
      const data = await psyResponse.json();
      drawPsychologistsChart(data);
    } else {
      console.warn('Advertencia: No se pudo cargar el historial de psicólogos.', psyResponse.status);
    }

    // 2. Gráfica de Pacientes Premium
    if (patResponse.ok) {
      const data = await patResponse.json();
      drawPatientsChart(data);
    } else {
      console.warn('Advertencia: No se pudo cargar el historial de pacientes.', patResponse.status);
    }

    // 3. Gráfica de Citas
    if (apptResponse.ok) {
      const data = await apptResponse.json();
      drawAppointmentsChart(data);
    } else {
      console.warn('Advertencia: No se pudo cargar el historial de citas.', apptResponse.status);
    }

  } catch (error) {
    console.error('Error cargando los datos históricos:', error);
    await Swal.fire({
      icon: 'error',
      title: 'Fallo de Carga',
      text: 'Error cargando los datos de tendencias: ' + (error.message || 'Error desconocido'),
      confirmButtonColor: '#106f8c',
    });
  } finally {
    document.getElementById('loading').style.display = 'none';
  }
}

/**
 * Dibuja la gráfica de nuevos psicólogos registrados por mes.
 * @param {Array<{date: string, count: number}>} 
 */
function drawPsychologistsChart(historicalData) {
    const ctx = document.getElementById('psychologistsChart')?.getContext('2d');
    if (!ctx) return;

    if (psychologistsChartInstance) {
        psychologistsChartInstance.destroy();
    }
    const labels = historicalData.map(item => {
        const [year, month] = item.date.split('-');
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 
                           'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${monthNames[parseInt(month) - 1]} ${year}`;
    });
    
    const dataCounts = historicalData.map(item => item.count);

    psychologistsChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Psicólogos Registrados',
                data: dataCounts,
                borderColor: '#106f8c',
                backgroundColor: 'rgba(16, 111, 140, 0.2)',
                tension: 0.3,
                fill: true,
                pointBackgroundColor: '#106f8c',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Nuevos Registros' },
                    ticks: { 
                        precision: 0
                    }
                },
                x: {
                    title: { display: true, text: 'Mes' }
                }
            },
            plugins: {
                legend: { display: true }, 
                title: { display: false }
            }
        }
    });
}

/**
 * Dibuja la gráfica de pacientes premium adquiridos por mes.
 * @param {Array<{date: string, count: number}>} 
 */
function drawPatientsChart(historicalData) {
    const ctx = document.getElementById('patientsChart')?.getContext('2d');
    if (!ctx) return;

    if (patientsChartInstance) {
        patientsChartInstance.destroy();
    }

    const labels = historicalData.map(item => {
        const parts = item.date.split('-');
        return parts.length === 2 ? `${parts[1]}/${parts[0].substring(2)}` : item.date;
    });
    const dataCounts = historicalData.map(item => item.count);

    patientsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Suscripciones Premium',
                data: dataCounts,
                backgroundColor: '#28a745',
                hoverBackgroundColor: '#218838'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Nuevas Suscripciones' },
                    ticks: { callback: function(value) { if (value % 1 === 0) { return value; } return null; } }
                }
            },
            plugins: {
                legend: { display: false },
                title: { display: false }
            }
        }
    });
}

/**
 * Dibuja la gráfica de citas agendadas por mes.
 * @param {Array<{date: string, count: number}>} 
 */
function drawAppointmentsChart(historicalData) {
    const ctx = document.getElementById('appointmentsChart')?.getContext('2d');
    if (!ctx) return;

    if (appointmentsChartInstance) {
        appointmentsChartInstance.destroy();
    }

    const labels = historicalData.map(item => {
        const parts = item.date.split('-');
        return parts.length === 2 ? `${parts[1]}/${parts[0].substring(2)}` : item.date;
    });
    const dataCounts = historicalData.map(item => item.count);

    appointmentsChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Citas Agendadas',
                data: dataCounts,
                borderColor: '#ffc107', 
                backgroundColor: 'rgba(255, 193, 7, 0.2)',
                tension: 0.3,
                fill: true,
                pointBackgroundColor: '#ffc107',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Cantidad de Citas' },
                    ticks: { callback: function(value) { if (value % 1 === 0) { return value; } return null; } }
                }
            },
            plugins: {
                legend: { display: false },
                title: { display: false }
            }
        }
    });
}
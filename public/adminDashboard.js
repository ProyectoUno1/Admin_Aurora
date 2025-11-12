// Función para cargar todas las estadísticas del dashboard
async function fetchAllStats(idToken) {
    try {
        // Cargar estadísticas en paralelo
        await Promise.all([
            fetchPsychologistStats(idToken),
            fetchPatientStats(idToken),
            fetchArticleStats(idToken),
            fetchAppointmentStats(idToken),
            fetchTicketStats(idToken),
            fetchPaymentStats(idToken)
        ]);
    } catch (error) {
        console.error("Error al cargar estadísticas:", error);
    }
}

// Estadísticas de psicólogos
async function fetchPsychologistStats(idToken) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/stats/psychologists`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${idToken}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            console.error("No se pudieron cargar las estadísticas de psicólogos.");
            return;
        }

        const stats = await response.json();
        
        // Actualizar tarjetas de estadísticas
        const activePsychEl = document.querySelector('.stat-card:nth-child(1) .stat-number');
        const pendingValidEl = document.querySelector('.stat-card:nth-child(2) .stat-number');
        
        if (activePsychEl) activePsychEl.textContent = stats.active || 0;
        if (pendingValidEl) pendingValidEl.textContent = stats.pending || 0;
        
        // Actualizar badge en la tarjeta de acción
        const pendingValidBadge = document.getElementById('pendingValidations');
        if (pendingValidBadge) {
            pendingValidBadge.textContent = `${stats.pending || 0} pendientes`;
        }
        
    } catch (error) {
        console.error("Error al obtener estadísticas de psicólogos:", error);
    }
}

// Estadísticas de pacientes
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
            console.error("No se pudieron cargar las estadísticas de pacientes.");
            return;
        }

        const data = await response.json();
        const patients = data.patients || [];
        
        // Contar pacientes donde isPremium es true
        const subscribedCount = patients.filter(p => p.isPremium === true).length; 
        
        // Actualizar el badge en el Dashboard principal
        const subscribedPatientsBadge = document.getElementById('subscribedPatients');
        if (subscribedPatientsBadge) {
            subscribedPatientsBadge.textContent = `${subscribedCount} Suscritos`;
        }
        
    } catch (error) {
        console.error("Error al obtener estadísticas de pacientes:", error);
        const badge = document.getElementById('subscribedPatients');
        if (badge) badge.textContent = 'Error';
    }
}

// Estadísticas de artículos
async function fetchArticleStats(idToken) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/admin/articles/stats/overview`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${idToken}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            console.error("No se pudieron cargar las estadísticas de artículos.");
            return;
        }

        const stats = await response.json();
        
        // Actualizar tarjeta de estadísticas
        const articleStatEl = document.querySelector('.stat-card:nth-child(5) .stat-number');
        if (articleStatEl) {
            articleStatEl.textContent = stats.total || 0;
        }
        
        // Actualizar badge en la tarjeta de acción
        const pendingArticlesBadge = document.getElementById('pendingArticles');
        if (pendingArticlesBadge) {
            pendingArticlesBadge.textContent = `${stats.draft || 0} por revisar`;
        }
        
    } catch (error) {
        console.error("Error al obtener estadísticas de artículos:", error);
    }
}

// Estadísticas de citas
async function fetchAppointmentStats(idToken) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/admin/appointments`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${idToken}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            console.error("No se pudieron cargar las estadísticas de citas.");
            return;
        }

        const data = await response.json();
        const appointments = data.appointments || [];
        
        // Contar citas completadas y calificadas para el total de sesiones
        const completedSessions = appointments.filter(
            a => a.status === 'completed' || a.status === 'rated'
        ).length;
        
        // Contar citas pendientes
        const pendingAppointments = appointments.filter(
            a => a.status === 'pending' || a.status === 'confirmed'
        ).length;
        
        // Actualizar tarjeta de estadísticas
        const sessionStatEl = document.querySelector('.stat-card:nth-child(4) .stat-number');
        if (sessionStatEl) {
            sessionStatEl.textContent = completedSessions.toLocaleString();
        }
        
        // Actualizar badge en la tarjeta de acción
        const pendingAppointmentsBadge = document.getElementById('pendingAppointments');
        if (pendingAppointmentsBadge) {
            pendingAppointmentsBadge.textContent = `${pendingAppointments} Pendientes`;
        }
        
    } catch (error) {
        console.error("Error al obtener estadísticas de citas:", error);
    }
}

// Estadísticas de tickets
async function fetchTicketStats(idToken) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/support/tickets`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${idToken}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            console.error("No se pudieron cargar las estadísticas de tickets.");
            return;
        }

        const tickets = await response.json();
        
        // Contar tickets abiertos
        const openTickets = tickets.filter(
            t => t.status === 'open' || t.status === 'in_progress'
        ).length;
        
        // Actualizar badge en la tarjeta de acción
        const pendingTicketsBadge = document.getElementById('pendingTickets');
        if (pendingTicketsBadge) {
            pendingTicketsBadge.textContent = `${openTickets} Abiertos`;
        }
        
    } catch (error) {
        console.error("Error al obtener estadísticas de tickets:", error);
    }
}

// Estadísticas de pagos
async function fetchPaymentStats(idToken) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/admin/psychologists/payments`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${idToken}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            console.error("No se pudieron cargar las estadísticas de pagos.");
            return;
        }

        const data = await response.json();
        const payments = data.payments || [];
        
        // Contar pagos pendientes
        const pendingPayments = payments.filter(p => p.totalPending > 0).length;
        
        // Actualizar badge en la tarjeta de acción
        const pendingPaymentsBadge = document.getElementById('pendingPaymentsCount');
        if (pendingPaymentsBadge) {
            pendingPaymentsBadge.textContent = `${pendingPayments} Pendientes`;
        }
        
    } catch (error) {
        console.error("Error al obtener estadísticas de pagos:", error);
        const badge = document.getElementById('pendingPaymentsCount');
        if (badge) badge.textContent = 'Error';
    }
}
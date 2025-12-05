import { auth, BACKEND_URL } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

let currentUser = null;
let currentFilters = {
    status: 'all',
    category: '',
    search: '',
    orderBy: 'createdAt',
    order: 'desc',
    page: 1,
    limit: 20
};

// Verificar autenticación
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'loginAdmin.html';
        return;
    }
    currentUser = user;
    await loadInitialData();
});

// Cargar datos iniciales
async function loadInitialData() {
    try {
        await loadStats();
        await loadArticles();
    } catch (error) {
        console.error('Error cargando datos:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error de Carga',
            text: 'No se pudieron cargar los datos iniciales. Inténtalo de nuevo.',
        });
    }
}

// Cargar estadísticas
async function loadStats() {
    try {
        const idToken = await currentUser.getIdToken();
        const response = await fetch(`${BACKEND_URL}/api/admin/articles/stats/overview`, {
            headers: {
                'Authorization': `Bearer ${idToken}`
            }
        });

        if (!response.ok) throw new Error('Error cargando estadísticas');

        const stats = await response.json();
        displayStats(stats);
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
    }
}

// Mostrar estadísticas
function displayStats(stats) {
    const statsGrid = document.getElementById('statsGrid');
    statsGrid.innerHTML = `
        <div class="stat-card">
            <div class="stat-number">${stats.total}</div>
            <div class="stat-label">Total Artículos</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.published}</div>
            <div class="stat-label">Publicados</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.draft}</div>
            <div class="stat-label">Borradores</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.totalViews.toLocaleString()}</div>
            <div class="stat-label">Total Vistas</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.totalLikes.toLocaleString()}</div>
            <div class="stat-label">Total Likes</div>
        </div>
    `;
}

// Cargar artículos
async function loadArticles() {
    try {
        document.getElementById('loading').style.display = 'block';
        document.getElementById('articlesContainer').style.display = 'none';
        document.getElementById('emptyState').style.display = 'none';

        const idToken = await currentUser.getIdToken();
        const params = new URLSearchParams(currentFilters);

        const response = await fetch(`${BACKEND_URL}/api/admin/articles?${params}`, {
            headers: {
                'Authorization': `Bearer ${idToken}`
            }
        });

        if (!response.ok) throw new Error('Error cargando artículos');

        const data = await response.json();
        displayArticles(data.articles, data.pagination, data.stats);

    } catch (error) {
        console.error('Error cargando artículos:', error);
        document.getElementById('loading').style.display = 'none';
        document.getElementById('articlesContainer').style.display = 'none';
        document.getElementById('emptyState').style.display = 'block';
        // Opcional: Notificar al usuario con Swal.fire si la carga falla
    }
}

// Mostrar artículos
function displayArticles(articles, pagination, stats) {
    document.getElementById('loading').style.display = 'none';

    if (articles.length === 0) {
        document.getElementById('emptyState').style.display = 'block';
        return;
    }

    document.getElementById('articlesContainer').style.display = 'block';
    document.getElementById('articlesCount').textContent = `${articles.length} artículos`;

    const tbody = document.getElementById('articlesTableBody');
    tbody.innerHTML = articles.map(article => {
        // Determinar qué botones mostrar según el estado actual
        let actionButtons = '';
        
        switch(article.status) {
            case 'draft':
                actionButtons = `
                    <button class="btn btn-sm btn-success" onclick="changeStatus('${article.id}', 'published')" 
                            title="Publicar artículo">
                        Publicar
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="changeStatus('${article.id}', 'archived')" 
                            title="Archivar artículo">
                        Archivar
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="changeStatus('${article.id}', 'deleted')" 
                            title="Eliminar artículo">
                        Eliminar
                    </button>
                `;
                break;
                
            case 'published':
                actionButtons = `
                    <button class="btn btn-sm btn-warning" onclick="changeStatus('${article.id}', 'draft')" 
                            title="Marcar como borrador">
                        Despublicar
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="changeStatus('${article.id}', 'archived')" 
                            title="Archivar artículo">
                        Archivar
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="changeStatus('${article.id}', 'deleted')" 
                            title="Eliminar artículo">
                        Eliminar
                    </button>
                `;
                break;
                
            case 'archived':
                actionButtons = `
                    <button class="btn btn-sm btn-success" onclick="changeStatus('${article.id}', 'draft')" 
                            title="Restaurar a borrador">
                        Desarchivar
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="changeStatus('${article.id}', 'deleted')" 
                            title="Eliminar artículo">
                        Eliminar
                    </button>
                `;
                break;
                
            case 'deleted':
                actionButtons = `
                    <button class="btn btn-sm btn-success" onclick="changeStatus('${article.id}', 'draft')" 
                            title="Restaurar artículo">
                        Restaurar
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="permanentDelete('${article.id}')" 
                            title="Eliminar permanentemente">
                        Eliminar Permanente
                    </button>
                `;
                break;
                
            default:
                if (!article.isPublished) {
                    actionButtons = `
                        <button class="btn btn-sm btn-success" onclick="changeStatus('${article.id}', 'published')" 
                                title="Publicar artículo">
                            Publicar
                        </button>
                    `;
                }
        }

        return `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        ${article.imageUrl ? `
                            <img src="${article.imageUrl}" 
                                alt="${article.title}" 
                                style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; border: 2px solid #e0e0e0;"
                                onerror="this.src='https://via.placeholder.com/60x60?text=Sin+Imagen'">
                        ` : `
                            <div style="width: 60px; height: 60px; background: #f0f0f0; border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 2px solid #e0e0e0;">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="#999">
                                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                                </svg>
                            </div>
                        `}
                        <div>
                            <div class="article-title" title="${article.title}">
                                <strong>${article.title}</strong>
                            </div>
                            <div class="article-meta">
                                ID: ${article.id}
                            </div>
                        </div>
                    </div>
                </td>
                <td>
                    <div>${article.psychologistName || 'N/A'}</div>
                    <div class="article-meta">${article.psychologistEmail || ''}</div>
                </td>
                <td>
                    <span class="status-badge status-${article.status}">
                        ${getStatusText(article.status)}
                    </span>
                </td>
                <td>${article.category || 'Sin categoría'}</td>
                <td>
                    <div>${article.views || 0} vistas</div>
                    <div>${article.likes || 0} likes</div>
                </td>
                <td>
                    <div>${formatDate(article.createdAt)}</div>
                    ${article.publishedAt ? `<div class="article-meta">Pub: ${formatDate(article.publishedAt)}</div>` : ''}
                </td>
                <td>
                    <div class="article-actions">
                        <button class="btn btn-sm btn-info" onclick="viewArticle('${article.id}')" 
                                title="Ver detalles del artículo">
                            Ver
                        </button>
                        ${actionButtons}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Obtener texto del estado
function getStatusText(status) {
    const statusTexts = {
        draft: 'Borrador',
        published: 'Publicado',
        archived: 'Archivado',
        deleted: 'Eliminado'
    };
    return statusTexts[status] || status;
}

// Formatear fecha
function formatDate(date) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Ver detalles del artículo
window.viewArticle = async function (articleId) {
    try {
        const idToken = await currentUser.getIdToken();
        const response = await fetch(`${BACKEND_URL}/api/admin/articles/${articleId}`, {
            headers: {
                'Authorization': `Bearer ${idToken}`
            }
        });

        if (!response.ok) throw new Error('Error cargando artículo');

        const data = await response.json();
        const article = data.article;

        document.getElementById('modalBody').innerHTML = `
            <div class="article-detail-header">
                ${article.imageUrl ? `
                    <div style="margin-bottom: 20px;">
                        <img src="${article.imageUrl}" 
                             alt="${article.title}" 
                             style="width: 100%; max-height: 400px; object-fit: cover; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div style="display: none; width: 100%; height: 300px; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 12px; align-items: center; justify-content: center; flex-direction: column; gap: 10px;">
                            <svg width="60" height="60" viewBox="0 0 24 24" fill="#999">
                                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                            </svg>
                            <span style="color: #999; font-weight: 500;">Error cargando imagen</span>
                        </div>
                    </div>
                ` : `
                    <div style="margin-bottom: 20px; width: 100%; height: 300px; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 10px; border: 2px dashed #d0d0d0;">
                        <svg width="60" height="60" viewBox="0 0 24 24" fill="#999">
                            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                        </svg>
                        <span style="color: #999; font-weight: 500;">Sin imagen</span>
                    </div>
                `}
                
                <h4>${article.title}</h4>
                <div class="article-detail-meta">
                    <div><strong>ID:</strong> ${article.id}</div>
                    <div><strong>Estado:</strong> <span class="status-badge status-${article.status}">${getStatusText(article.status)}</span></div>
                    <div><strong>Psicólogo:</strong> ${article.psychologist?.name || 'N/A'} (${article.psychologist?.email || 'N/A'})</div>
                    <div><strong>Categoría:</strong> ${article.category || 'Sin categoría'}</div>
                    <div><strong>Tiempo de lectura:</strong> ${article.readingTimeMinutes || 0} minutos</div>
                    <div><strong>Vistas:</strong> ${article.views || 0}</div>
                    <div><strong>Likes:</strong> ${article.likesCount || 0}</div>
                    <div><strong>Creado:</strong> ${formatDate(article.createdAt)}</div>
                    ${article.publishedAt ? `<div><strong>Publicado:</strong> ${formatDate(article.publishedAt)}</div>` : ''}
                    ${article.updatedAt ? `<div><strong>Actualizado:</strong> ${formatDate(article.updatedAt)}</div>` : ''}
                    ${article.imageUrl ? `<div><strong>URL Imagen:</strong> <a href="${article.imageUrl}" target="_blank" style="color: #3498db; text-decoration: none;">Ver imagen completa ↗</a></div>` : ''}
                    ${article.tags?.length > 0 ? `
                    <div>
                        <strong>Tags:</strong> 
                        <div class="tags-container">
                            ${article.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                        </div>
                    </div>` : '<div><strong>Tags:</strong> Sin tags</div>'}
                </div>
            </div>
            
            ${article.summary ? `
            <div class="detail-section">
                <h5>Resumen</h5>
                <div class="detail-section-content">
                    <p>${article.summary}</p>
                </div>
            </div>
            ` : ''}

            <div class="detail-section">
                <h5>Contenido</h5>
                <div class="detail-section-content article-content">
                    <pre>${article.content}</pre>
                </div>
            </div>

            ${article.adminNote ? `
            <div class="detail-section admin-note">
                <h5>Nota del Administrador</h5>
                <div class="detail-section-content">
                    <p>${article.adminNote}</p>
                </div>
            </div>
            ` : ''}
        `;

        // Configurar botones de acción
        const modalActions = document.querySelector('.modal-actions');
        modalActions.innerHTML = `
            ${article.status === 'draft' ?
                `<button class="btn btn-success" onclick="changeStatusFromModal('${article.id}', 'published')">Publicar</button>` :
                article.status === 'published' ?
                    `<button class="btn btn-warning" onclick="changeStatusFromModal('${article.id}', 'draft')">Despublicar</button>` :
                    ''
            }
            ${article.status !== 'archived' ?
                `<button class="btn btn-secondary" onclick="changeStatusFromModal('${article.id}', 'archived')">Archivar</button>` :
                `<button class="btn btn-success" onclick="changeStatusFromModal('${article.id}', 'draft')">Desarchivar</button>`
            }
            <button class="btn btn-info" onclick="closeModal()">Cerrar</button>
        `;

        document.getElementById('articleModal').style.display = 'block';

    } catch (error) {
        console.error('Error cargando detalles del artículo:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error de Carga',
            text: 'Error cargando detalles del artículo. Inténtalo de nuevo.',
        });
    }
}

// Cerrar modal con Escape key
document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
        closeModal();
    }
});

// Cambiar estado del artículo
window.changeStatus = async function (articleId, newStatus) {
    const statusTexts = {
        published: 'publicado',
        draft: 'marcado como borrador',
        archived: 'archivado',
        deleted: 'eliminado'
    };

    const confirmMessages = {
        published: '¿Estás seguro de que quieres publicar este artículo?',
        draft: '¿Estás seguro de que quieres marcar este artículo como borrador?',
        archived: '¿Estás seguro de que quieres archivar este artículo?',
        deleted: '¿Estás seguro de que quieres eliminar este artículo (mover a papelera)?'
    };

    // 1. Confirmación con SweetAlert
    const result = await Swal.fire({
        title: 'Confirmar Acción',
        text: confirmMessages[newStatus],
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: newStatus === 'deleted' ? '#dc3545' : '#106f8c',
        cancelButtonColor: '#6c757d',
        confirmButtonText: `Sí, ${statusTexts[newStatus]}`,
        cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) {
        return;
    }

    // 2. Mostrar indicador de carga con SweetAlert
    Swal.fire({
        title: 'Actualizando estado...',
        text: 'Por favor, espera. Esta acción puede tardar unos segundos.',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        const idToken = await currentUser.getIdToken();
        
        const response = await fetch(`${BACKEND_URL}/api/admin/articles/${articleId}/status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: newStatus,
                adminNote: newStatus === 'deleted' ? 'Eliminado por administrador' : null
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Error ${response.status}: ${errorData.error || 'Error desconocido'}`);
        }

        const result = await response.json();
        
        // 3. Mostrar mensaje de éxito
        Swal.close();
        await Swal.fire({
            icon: 'success',
            title: '¡Éxito!',
            text: result.message || `Artículo ${statusTexts[newStatus]} exitosamente.`,
            confirmButtonColor: '#106f8c',
        });
        
        // Recargar datos para reflejar cambios
        await Promise.all([loadArticles(), loadStats()]);

    } catch (error) {
        // 4. Mostrar mensaje de error
        Swal.close();
        await Swal.fire({
            icon: 'error',
            title: 'Error al actualizar',
            text: `No se pudo actualizar el estado del artículo: ${error.message}`,
        });
    }
}

// Cambiar estado desde modal
window.changeStatusFromModal = async function (articleId, newStatus) {
    // La función changeStatus maneja la confirmación y la carga con SweetAlert
    await changeStatus(articleId, newStatus);
    // Si la acción fue exitosa, se recargan los artículos, lo que hace que el modal ya no sea relevante.
    // Simplemente cerramos el modal aquí para asegurar.
    closeModal(); 
}

// Eliminar permanentemente
window.permanentDelete = async function (articleId) {
    // 1. Primer confirmación
    const firstConfirm = await Swal.fire({
        title: 'Eliminación Permanente',
        text: 'Esta acción eliminará permanentemente el artículo y no se puede deshacer. ¿Continuar?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, ¡Eliminar!',
        cancelButtonText: 'Cancelar'
    });

    if (!firstConfirm.isConfirmed) {
        return;
    }

    // 2. Confirmación final
    const finalConfirm = await Swal.fire({
        title: 'CONFIRMACIÓN FINAL',
        text: 'Se eliminará el artículo y todos sus datos relacionados (vistas, likes). Esta acción es irreversible. ¿Confirmas?',
        icon: 'error',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: '¡SÍ, ELIMINAR PERMANENTEMENTE!',
        cancelButtonText: 'Volver atrás'
    });

    if (!finalConfirm.isConfirmed) {
        return;
    }

    // 3. Mostrar indicador de carga con SweetAlert
    Swal.fire({
        title: 'Eliminando permanentemente...',
        text: 'Procesando la solicitud, por favor, espera.',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        const idToken = await currentUser.getIdToken();
        const response = await fetch(`${BACKEND_URL}/api/admin/articles/${articleId}/permanent`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                confirmPermanentDelete: true
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error eliminando artículo');
        }

        const result = await response.json();

        // 4. Mostrar mensaje de éxito
        Swal.close();
        await Swal.fire({
            icon: 'success',
            title: '¡Eliminación Exitosa!',
            text: result.message || 'El artículo ha sido eliminado permanentemente.',
            confirmButtonColor: '#106f8c',
        });
        
        await Promise.all([loadArticles(), loadStats()]);

    } catch (error) {
        // 5. Mostrar mensaje de error
        Swal.close();
        console.error('Error eliminando artículo:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error al eliminar',
            text: 'Error eliminando artículo permanentemente. Revisa la consola para más detalles.',
        });
    }
}

// Aplicar filtros
window.applyFilters = function () {
    currentFilters = {
        status: document.getElementById('statusFilter').value,
        category: document.getElementById('categoryFilter').value,
        search: document.getElementById('searchInput').value,
        orderBy: document.getElementById('orderByFilter').value,
        order: 'desc',
        page: 1,
        limit: 20
    };
    loadArticles();
}


// Cerrar modal
window.closeModal = function () {
    document.getElementById('articleModal').style.display = 'none';
}

// Cerrar modal al hacer clic fuera
window.onclick = function (event) {
    const modal = document.getElementById('articleModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}

// Logout
window.logout = async function () {
    try {
        await auth.signOut();
        localStorage.removeItem('firebaseIdToken');
        localStorage.removeItem('adminData');
        window.location.href = 'loginAdmin.html';
    } catch (error) {
        console.error('Error en logout:', error);
    }
}

// Event listeners para filtros en tiempo real
document.getElementById('statusFilter').addEventListener('change', applyFilters);
document.getElementById('categoryFilter').addEventListener('change', applyFilters);
document.getElementById('searchInput').addEventListener('input', debounce(applyFilters, 500));
document.getElementById('orderByFilter').addEventListener('change', applyFilters);

// Función debounce para search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
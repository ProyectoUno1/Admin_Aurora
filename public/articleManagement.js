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
        document.getElementById('emptyState').style.display = 'block';
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
    tbody.innerHTML = articles.map(article => `
                <tr>
                    <td>
                        <div class="article-title" title="${article.title}">
                            <strong>${article.title}</strong>
                        </div>
                        <div class="article-meta">
                            ID: ${article.id}
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
                            <button class="btn btn-sm btn-info" onclick="viewArticle('${article.id}')">
                                Ver
                            </button>
                            ${article.status === 'draft' ?
            `<button class="btn btn-sm btn-success" onclick="changeStatus('${article.id}', 'published')">Publicar</button>` :
            article.status === 'published' ?
                `<button class="btn btn-sm btn-warning" onclick="changeStatus('${article.id}', 'draft')">Despublicar</button>` :
                ''
        }
                            ${article.status !== 'archived' ?
            `<button class="btn btn-sm btn-secondary" onclick="changeStatus('${article.id}', 'archived')">Archivar</button>` :
            `<button class="btn btn-sm btn-success" onclick="changeStatus('${article.id}', 'draft')">Desarchivar</button>`
        }
                            ${article.status !== 'deleted' ?
            `<button class="btn btn-sm btn-danger" onclick="changeStatus('${article.id}', 'deleted')">Eliminar</button>` :
            `<button class="btn btn-sm btn-danger" onclick="permanentDelete('${article.id}')">Eliminar Permanente</button>`
        }
                        </div>
                    </td>
                </tr>
            `).join('');
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
        alert('Error cargando detalles del artículo');
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
        published: 'publicar',
        draft: 'marcar como borrador',
        archived: 'archivar',
        deleted: 'eliminar'
    };

    if (!confirm(`¿Estás seguro de que quieres ${statusTexts[newStatus]} este artículo?`)) {
        return;
    }

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

        if (!response.ok) throw new Error('Error actualizando estado');

        const result = await response.json();
        alert(result.message);
        await loadArticles();

    } catch (error) {
        console.error('Error actualizando estado:', error);
        alert('Error actualizando estado del artículo');
    }
}

// Cambiar estado desde modal
window.changeStatusFromModal = async function (articleId, newStatus) {
    await changeStatus(articleId, newStatus);
    closeModal();
}

// Eliminar permanentemente
window.permanentDelete = async function (articleId) {
    if (!confirm('¿Estás seguro? Esta acción eliminará permanentemente el artículo y no se puede deshacer.')) {
        return;
    }

    if (!confirm('CONFIRMACIÓN FINAL: Se eliminará el artículo y todos sus datos relacionados. ¿Continuar?')) {
        return;
    }

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

        if (!response.ok) throw new Error('Error eliminando artículo');

        const result = await response.json();
        alert(result.message);
        await loadArticles();
        await loadStats();

    } catch (error) {
        console.error('Error eliminando artículo:', error);
        alert('Error eliminando artículo permanentemente');
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
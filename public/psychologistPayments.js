// psychologistPayments.js - CON COMPROBANTES EN BASE64
import { auth, BACKEND_URL } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let allPayments = [];
let currentPsychologist = null;
let authToken = null;
let selectedPayments = new Set();
let isBulkPaymentMode = false;
let selectedReceiptFile = null;
let receiptBase64 = null;

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Iniciando módulo de pagos con comprobantes...');
    setupAuthListener();
    setupEventListeners();
});

// Listener de autenticación
function setupAuthListener() {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            console.log('❌ No hay usuario autenticado');
            window.location.href = 'loginAdmin.html';
            return;
        }

        try {
            console.log('✅ Usuario autenticado:', user.email);
            authToken = await user.getIdToken(true);
            window.authToken = authToken;
            
            const response = await fetch(`${BACKEND_URL}/api/login/verify`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Sin privilegios de administrador');
            }

            const emailEl = document.getElementById('userEmail');
            if (emailEl) emailEl.textContent = user.email;
            
            await loadPaymentsData();

        } catch (error) {
            console.error('❌ Error en autenticación:', error);
            await Swal.fire({
                icon: 'error',
                title: 'Error de Autenticación',
                text: error.message
            });
            window.location.href = 'loginAdmin.html';
        }
    });
}

// Event listeners
function setupEventListeners() {
    document.getElementById('searchInput')?.addEventListener('input', filterPayments);
    document.getElementById('filterStatus')?.addEventListener('change', filterPayments);
    
    // Listener para el input de archivo
    const receiptInput = document.getElementById('paymentReceipt');
    if (receiptInput) {
        receiptInput.addEventListener('change', handleReceiptSelection);
    }
}

// ============= MANEJO DE COMPROBANTES =============

async function handleReceiptSelection(event) {
    const file = event.target.files[0];
    const previewDiv = document.getElementById('receiptPreview');
    const errorDiv = document.getElementById('card-errors');
    
    if (!file) {
        selectedReceiptFile = null;
        receiptBase64 = null;
        if (previewDiv) previewDiv.innerHTML = '';
        return;
    }
    
    // Limpiar errores
    if (errorDiv) errorDiv.textContent = '';
    
    // Validar tipo de archivo
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
        if (errorDiv) errorDiv.textContent = '❌ Solo se permiten archivos JPG, PNG, WEBP o PDF';
        event.target.value = '';
        selectedReceiptFile = null;
        receiptBase64 = null;
        return;
    }
    
    // Validar tamaño del archivo original (máximo 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        if (errorDiv) errorDiv.textContent = '❌ El archivo debe ser menor a 5MB';
        event.target.value = '';
        selectedReceiptFile = null;
        receiptBase64 = null;
        return;
    }
    
    // Mostrar indicador de carga
    if (previewDiv) {
        previewDiv.innerHTML = `
            <div style="
                background: #f0f9ff;
                border: 2px solid #3b82f6;
                border-radius: 8px;
                padding: 12px;
                margin-top: 10px;
                text-align: center;
            ">
                <div class="spinner" style="
                    margin: 0 auto 10px;
                    border: 3px solid rgba(59, 130, 246, 0.3);
                    border-top-color: #3b82f6;
                    border-radius: 50%;
                    width: 30px;
                    height: 30px;
                    animation: spin 1s linear infinite;
                "></div>
                <div style="color: #1e40af; font-size: 0.9rem;">
                    Procesando comprobante...
                </div>
            </div>
        `;
    }
    
    // Convertir a Base64 (con compresión automática)
    try {
        console.log('📄 Convirtiendo archivo a Base64...');
        const base64 = await fileToBase64(file);
        
        // Validar tamaño del Base64 resultante
        const base64Size = base64.length * 0.75; // Tamaño aproximado en bytes
        const maxBase64Size = 8 * 1024 * 1024; // 8MB en Base64
        
        if (base64Size > maxBase64Size) {
            throw new Error('El comprobante procesado es demasiado grande. Intenta con una imagen de menor resolución.');
        }
        
        selectedReceiptFile = file;
        receiptBase64 = base64;
        
        // Mostrar vista previa
        displayReceiptPreview(file, base64);
        
        console.log('✅ Comprobante cargado:', {
            name: file.name,
            originalSize: `${(file.size / 1024).toFixed(2)} KB`,
            base64Size: `${(base64Size / 1024).toFixed(2)} KB`,
            type: file.type
        });
        
    } catch (error) {
        console.error('❌ Error al cargar comprobante:', error);
        if (errorDiv) errorDiv.textContent = `❌ ${error.message || 'Error al procesar el archivo'}`;
        selectedReceiptFile = null;
        receiptBase64 = null;
        if (previewDiv) previewDiv.innerHTML = '';
    }
}

// Convertir archivo a Base64 con compresión automática
async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        // Si es PDF, no comprimir, solo convertir
        if (file.type === 'application/pdf') {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
            return;
        }
        
        // Si es imagen, comprimir primero
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Crear canvas para redimensionar
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Calcular nuevas dimensiones (máximo 1920x1920)
                let width = img.width;
                let height = img.height;
                const maxSize = 1920;
                
                if (width > maxSize || height > maxSize) {
                    if (width > height) {
                        height = (height / width) * maxSize;
                        width = maxSize;
                    } else {
                        width = (width / height) * maxSize;
                        height = maxSize;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Dibujar imagen redimensionada
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convertir a Base64 con calidad ajustada
                // JPEG con 80% de calidad para balance tamaño/calidad
                const quality = 0.8;
                const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                
                console.log('🗜️ Imagen comprimida:', {
                    original: `${(file.size / 1024).toFixed(2)} KB`,
                    compressed: `${(compressedBase64.length * 0.75 / 1024).toFixed(2)} KB`,
                    dimensions: `${width}x${height}`
                });
                
                resolve(compressedBase64);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Mostrar vista previa del comprobante
function displayReceiptPreview(file, base64) {
    const previewDiv = document.getElementById('receiptPreview');
    if (!previewDiv) return;
    
    const isPDF = file.type === 'application/pdf';
    
    previewDiv.innerHTML = `
        <div style="
            background: #f0fdf4;
            border: 2px solid #10b981;
            border-radius: 8px;
            padding: 12px;
            margin-top: 10px;
            display: flex;
            align-items: center;
            gap: 12px;
        ">
            ${isPDF ? `
                <svg width="40" height="40" viewBox="0 0 24 24" fill="#10b981">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18.5,9H13V3.5L18.5,9M6,20V4H12V10H18V20H6Z"/>
                </svg>
            ` : `
                <img 
                    src="${base64}" 
                    alt="Vista previa" 
                    style="
                        width: 60px;
                        height: 60px;
                        object-fit: cover;
                        border-radius: 4px;
                        border: 1px solid #10b981;
                    "
                >
            `}
            <div style="flex: 1;">
                <div style="font-weight: 600; color: #059669; font-size: 0.9rem;">
                    ✅ Comprobante cargado
                </div>
                <div style="font-size: 0.85rem; color: #6b7280; margin-top: 4px;">
                    ${file.name} (${(file.size / 1024).toFixed(2)} KB)
                </div>
            </div>
            <button 
                onclick="removeReceipt()" 
                style="
                    background: #fee2e2;
                    color: #991b1b;
                    border: none;
                    border-radius: 4px;
                    padding: 6px 12px;
                    cursor: pointer;
                    font-size: 0.85rem;
                    font-weight: 600;
                "
            >
                🗑️ Eliminar
            </button>
        </div>
    `;
}

// Eliminar comprobante seleccionado
function removeReceipt() {
    selectedReceiptFile = null;
    receiptBase64 = null;
    
    const receiptInput = document.getElementById('paymentReceipt');
    if (receiptInput) receiptInput.value = '';
    
    const previewDiv = document.getElementById('receiptPreview');
    if (previewDiv) previewDiv.innerHTML = '';
    
    console.log('🗑️ Comprobante eliminado');
}

// ============= CARGAR DATOS =============

async function loadPaymentsData() {
    const loading = document.getElementById('loading');
    const mainContent = document.getElementById('mainContent');

    try {
        loading.style.display = 'flex';
        mainContent.style.display = 'none';

        console.log('📡 Cargando datos de pagos...');
        const response = await fetch(`${BACKEND_URL}/api/admin/psychologists/payments`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 401) {
            throw new Error('Sesión expirada');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Error ${response.status}`);
        }

        const data = await response.json();
        console.log('✅ Datos cargados:', data);
        
        allPayments = data.payments || [];
        updateStats(data);
        displayPayments(allPayments);
        showImportantAlerts(allPayments);

    } catch (error) {
        console.error('❌ Error cargando pagos:', error);
        
        if (error.message.includes('expirada')) {
            await Swal.fire({
                icon: 'error',
                title: 'Sesión Expirada',
                text: 'Serás redirigido al login',
                timer: 2000
            });
            window.location.href = 'loginAdmin.html';
            return;
        }

        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'No se pudieron cargar los datos'
        });
    } finally {
        loading.style.display = 'none';
        mainContent.style.display = 'block';
    }
}

function showImportantAlerts(payments) {
    const noBankInfo = payments.filter(p => !p.hasBankInfo && p.totalPending > 0);
    const highAmounts = payments.filter(p => p.totalPending > 10000);
    
    if (noBankInfo.length > 0) {
        console.warn(`⚠️ ${noBankInfo.length} psicólogo(s) sin info bancaria`);
    }
    
    if (highAmounts.length > 0) {
        console.warn(`💰 ${highAmounts.length} psicólogo(s) con montos > $10,000`);
    }
}

function updateStats(data) {
    document.getElementById('totalPsychologists').textContent = allPayments.length;
    document.getElementById('totalPending').textContent = formatCurrency(data.totalPending || 0);
    document.getElementById('totalPaid').textContent = formatCurrency(data.totalPaid || 0);
    
    document.getElementById('summaryPending').textContent = formatCurrency(data.totalPending || 0);
    document.getElementById('summaryPaid').textContent = formatCurrency(data.totalPaid || 0);
}

function filterPayments() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('filterStatus').value;

    let filtered = allPayments.filter(payment => {
        const matchesSearch = payment.name.toLowerCase().includes(searchTerm) ||
                            payment.email.toLowerCase().includes(searchTerm);
        
        const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    displayPayments(filtered);
}

function displayPayments(payments) {
    const tableBody = document.getElementById('tableBody');
    const emptyState = document.getElementById('emptyState');

    if (!payments || payments.length === 0) {
        tableBody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    
    tableBody.innerHTML = payments.map(payment => `
        <tr data-id="${payment.psychologistId}" ${selectedPayments.has(payment.psychologistId) ? 'class="selected-row"' : ''}>
            <td>
                ${payment.totalPending > 0 ? `
                    <input 
                        type="checkbox" 
                        class="payment-checkbox" 
                        data-id="${payment.psychologistId}"
                        data-amount="${payment.totalPending}"
                        onchange="handleCheckboxChange(this)"
                        ${selectedPayments.has(payment.psychologistId) ? 'checked' : ''}
                        style="display: ${isBulkPaymentMode ? 'block' : 'none'};"
                    >
                ` : ''}
            </td>
            <td>
                <div class="psychologist-info">
                    <div class="psychologist-name">
                        ${escapeHtml(payment.name)}
                        ${!payment.hasBankInfo ? '<span class="alert-badge alert-no-bank">Sin Datos</span>' : ''}
                        ${payment.alerts?.highAmount ? '<span class="alert-badge alert-high-amount">Monto Alto</span>' : ''}
                    </div>
                    <div class="psychologist-email">${escapeHtml(payment.email)}</div>
                </div>
            </td>
            <td class="price-cell">${formatCurrency(payment.pricePerSession)}</td>
            <td class="text-center">
                <span class="sessions-number">${payment.completedSessions}</span>
            </td>
            <td class="text-right ${payment.status === 'pending' ? 'amount-pending' : 'amount-paid'}">
                ${formatCurrency(payment.totalPending)}
            </td>
            <td class="text-center date-cell">
                ${payment.lastPaymentDate ? formatDate(payment.lastPaymentDate) : 'Sin pagos previos'}
            </td>
            <td class="text-center">
                <span class="status-badge ${payment.status === 'paid' ? 'status-paid' : 'status-pending'}">
                    ${payment.status === 'paid' ? 'Pagado' : 'Pendiente'}
                </span>
            </td>
            <td>
                <div class="actions-cell">
                    ${payment.totalPending > 0 ? `
                        <button class="btn-mark-paid" onclick="openPaymentModal('${payment.psychologistId}')">
                            💰 Pagar
                        </button>
                    ` : ''}
                    <button class="btn-view-detail" onclick="viewBankInfo('${payment.psychologistId}')">
                        🏦 Banco
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ============= MODAL DE PAGO =============

function openPaymentModal(psychologistId) {
    console.log('🔓 Abriendo modal de pago para:', psychologistId);
    
    const payment = allPayments.find(p => p.psychologistId === psychologistId);
    if (!payment) {
        console.error('❌ No se encontró el psicólogo:', psychologistId);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se encontró información del psicólogo'
        });
        return;
    }
    
    currentPsychologist = payment;
    console.log('✅ Psicólogo seleccionado:', currentPsychologist.name);
    
    // Actualizar elementos del modal
    const modalPsych = document.getElementById('modalPsychologist');
    const modalAmount = document.getElementById('modalAmount');
    const modalSessions = document.getElementById('modalSessions');
    
    if (modalPsych) modalPsych.textContent = payment.name;
    if (modalAmount) modalAmount.textContent = formatCurrency(payment.totalPending);
    if (modalSessions) modalSessions.textContent = payment.completedSessions;
    
    // Limpiar campos
    const refInput = document.getElementById('paymentReference');
    const dateInput = document.getElementById('paymentDate');
    const notesInput = document.getElementById('paymentNotes');
    const methodSelect = document.getElementById('paymentMethodSelect');
    const receiptInput = document.getElementById('paymentReceipt');
    const errorsDiv = document.getElementById('card-errors');
    const previewDiv = document.getElementById('receiptPreview');
    
    if (refInput) refInput.value = '';
    if (dateInput) dateInput.value = '';
    if (notesInput) notesInput.value = '';
    if (methodSelect) methodSelect.value = 'bank_transfer';
    if (receiptInput) receiptInput.value = '';
    if (errorsDiv) errorsDiv.textContent = '';
    if (previewDiv) previewDiv.innerHTML = '';
    
    // Limpiar variables de comprobante
    selectedReceiptFile = null;
    receiptBase64 = null;
    
    // Mostrar modal
    const modal = document.getElementById('paymentModal');
    if (modal) {
        modal.classList.add('active');
        console.log('✅ Modal mostrado');
    }
}

function closePaymentModal() {
    document.getElementById('paymentModal')?.classList.remove('active');
    currentPsychologist = null;
    selectedReceiptFile = null;
    receiptBase64 = null;
}

function viewBankInfoFromModal() {
    if (currentPsychologist) {
        viewBankInfo(currentPsychologist.psychologistId);
    }
}

// ============= PROCESAR PAGO =============

async function processPayment() {
    if (!currentPsychologist) {
        console.error('❌ No hay psicólogo seleccionado');
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se encontró información del psicólogo. Por favor, intenta de nuevo.'
        });
        closePaymentModal();
        return;
    }
    
    const reference = document.getElementById('paymentReference')?.value.trim();
    const paymentMethod = document.getElementById('paymentMethodSelect')?.value;
    const paymentDate = document.getElementById('paymentDate')?.value;
    const notes = document.getElementById('paymentNotes')?.value.trim();
    const errorEl = document.getElementById('card-errors');
    
    // Validaciones
    if (!reference) {
        if (errorEl) errorEl.textContent = '❌ La referencia es obligatoria';
        return;
    }
    
    if (!receiptBase64) {
        if (errorEl) errorEl.textContent = '❌ Debes subir el comprobante de pago';
        return;
    }
    
    // Limpiar errores
    if (errorEl) errorEl.textContent = '';
    
    // Guardar datos antes de confirmación
    const psychologistData = { ...currentPsychologist };
    const receiptData = {
        base64: receiptBase64,
        fileName: selectedReceiptFile.name,
        fileType: selectedReceiptFile.type,
        fileSize: selectedReceiptFile.size
    };
    
    // Confirmar
    const result = await Swal.fire({
        title: '¿Confirmar Pago?',
        html: `
            <div style="text-align: left; padding: 10px;">
                <p style="margin-bottom: 10px;"><strong>Psicólogo:</strong> ${psychologistData.name}</p>
                <p style="margin-bottom: 10px;"><strong>Monto:</strong> ${formatCurrency(psychologistData.totalPending)}</p>
                <p style="margin-bottom: 10px;"><strong>Referencia:</strong> ${reference}</p>
                <p style="margin-bottom: 10px;"><strong>Método:</strong> ${paymentMethod}</p>
                <p style="margin-bottom: 10px;"><strong>Comprobante:</strong> ${receiptData.fileName}</p>
                <hr style="margin: 15px 0;">
                <p style="font-size: 0.9em; color: #666;">
                    ⚠️ Asegúrate de haber realizado la transferencia bancaria antes de confirmar.
                </p>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, Confirmar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#17a1a4'
    });
    
    if (!result.isConfirmed) return;
    
    // Procesar
    const btnSubmit = document.getElementById('btn-submit-payment');
    const btnText = document.getElementById('btn-text');
    const btnSpinner = document.getElementById('btn-spinner');
    
    if (btnSubmit) btnSubmit.disabled = true;
    if (btnText) btnText.style.display = 'none';
    if (btnSpinner) btnSpinner.style.display = 'block';
    
    try {
        console.log('💳 Procesando pago con comprobante...');
        
        const token = await getAuthToken();
        
        const response = await fetch(`${BACKEND_URL}/api/admin/psychologists/payments/mark-paid`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                psychologistId: psychologistData.psychologistId,
                amount: psychologistData.totalPending,
                paymentMethod: paymentMethod || 'bank_transfer',
                reference,
                paymentDate: paymentDate || null,
                notes: notes || '',
                // DATOS DEL COMPROBANTE
                receipt: {
                    base64: receiptData.base64,
                    fileName: receiptData.fileName,
                    fileType: receiptData.fileType,
                    fileSize: receiptData.fileSize,
                    uploadedAt: new Date().toISOString()
                }
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al procesar el pago');
        }
        
        const data = await response.json();
        console.log('✅ Pago procesado con comprobante:', data);
        
        closePaymentModal();
        
        await Swal.fire({
            icon: 'success',
            title: '¡Pago Registrado!',
            html: `
                <p>El pago ha sido registrado exitosamente</p>
                <p><strong>Referencia:</strong> ${reference}</p>
                <p><strong>Monto:</strong> ${formatCurrency(psychologistData.totalPending)}</p>
                <p><strong>Comprobante:</strong> ✅ Adjuntado</p>
            `,
            timer: 3000,
            showConfirmButton: false
        });
        
        await loadPaymentsData();
        
    } catch (error) {
        console.error('❌ Error procesando pago:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'No se pudo procesar el pago'
        });
    } finally {
        if (btnSubmit) btnSubmit.disabled = false;
        if (btnText) btnText.style.display = 'block';
        if (btnSpinner) btnSpinner.style.display = 'none';
    }
}

// ============= INFORMACIÓN BANCARIA =============

async function viewBankInfo(psychologistId) {
    try {
        console.log('🔍 Solicitando info bancaria para:', psychologistId);

        const response = await fetch(`${BACKEND_URL}/api/admin/bank-info/${psychologistId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 404) {
            Swal.fire({
                icon: 'warning',
                title: 'Sin Información Bancaria',
                text: 'Este psicólogo aún no ha registrado sus datos bancarios',
                footer: 'Solicítale que complete su perfil'
            });
            return;
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Error al obtener información bancaria');
        }

        const data = await response.json();
        
        if (!data.bankInfo) {
            Swal.fire({
                icon: 'warning',
                title: 'Sin Información Bancaria',
                text: 'Este psicólogo aún no ha registrado sus datos bancarios'
            });
            return;
        }

        displayBankInfoModal(data.bankInfo, data.psychologist);

    } catch (error) {
        console.error('❌ Error:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'No se pudo obtener la información bancaria'
        });
    }
}

function displayBankInfoModal(bankInfo, psychologist) {
    const contentDiv = document.getElementById('bankInfoContent');
    
    contentDiv.innerHTML = `
        <div class="bank-info-section">
            <h3>Información del Titular</h3>
            <div class="bank-info-item">
                <span class="bank-info-label">Nombre:</span>
                <span class="bank-info-value">${escapeHtml(bankInfo.accountHolderName || 'N/A')}</span>
            </div>
        </div>

        <div class="bank-info-section">
            <h3>Información Bancaria</h3>
            <div class="bank-info-item">
                <span class="bank-info-label">Banco:</span>
                <span class="bank-info-value">${escapeHtml(bankInfo.bankName || 'N/A')}</span>
            </div>
            <div class="bank-info-item">
                <span class="bank-info-label">Tipo de Cuenta:</span>
                <span class="bank-info-value">${escapeHtml(bankInfo.accountType || 'N/A')}</span>
            </div>
            <div class="bank-info-item">
                <span class="bank-info-label">CLABE:</span>
                <span class="bank-info-value">${escapeHtml(bankInfo.clabe || 'N/A')}</span>
            </div>
            ${bankInfo.accountNumber ? `
                <div class="bank-info-item">
                    <span class="bank-info-label">Número de Cuenta:</span>
                    <span class="bank-info-value">${escapeHtml(bankInfo.accountNumber)}</span>
                </div>
            ` : ''}
            ${bankInfo.isInternational ? `
                <div class="bank-info-item">
                    <span class="bank-info-label">Código SWIFT:</span>
                    <span class="bank-info-value">${escapeHtml(bankInfo.swiftCode || 'N/A')}</span>
                </div>
            ` : ''}
        </div>

        ${psychologist ? `
            <div class="bank-info-section">
                <h3>Resumen de Pago</h3>
                <div class="bank-info-item">
                    <span class="bank-info-label">Monto Pendiente:</span>
                    <span class="bank-info-value" style="color: #f59e0b; font-size: 1.1rem;">
                        ${formatCurrency(psychologist.pendingPayment || 0)}
                    </span>
                </div>
            </div>
        ` : ''}

        <div class="bank-info-warning">
            ⚠️ Verifica cuidadosamente los datos antes de realizar la transferencia
        </div>
    `;

    document.getElementById('bankInfoModal').classList.add('active');
}

function closeBankInfoModal() {
    document.getElementById('bankInfoModal')?.classList.remove('active');
}

async function copyBankInfoToClipboard() {
    const content = document.getElementById('bankInfoContent');
    const text = content.innerText;

    try {
        await navigator.clipboard.writeText(text);
        Swal.fire({
            icon: 'success',
            title: 'Copiado',
            text: 'Datos bancarios copiados al portapapeles',
            timer: 2000,
            showConfirmButton: false
        });
    } catch (error) {
        console.error('Error al copiar:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo copiar al portapapeles'
        });
    }
}

// ============= PAGO MASIVO (placeholder) =============

function toggleBulkPayment() {
    Swal.fire({
        icon: 'info',
        title: 'Pago Masivo',
        text: 'El pago masivo con comprobantes individuales estará disponible próximamente. Por ahora usa pagos individuales.',
        confirmButtonText: 'Entendido'
    });
}

function handleCheckboxChange(checkbox) {
    // Placeholder
}

function toggleSelectAll() {
    // Placeholder
}

function processBulkPayment() {
    // Placeholder
}

// ============= EXPORTAR =============

function exportToCSV() {
    const csvData = allPayments.map(payment => ({
        'Psicólogo': payment.name,
        'Email': payment.email,
        'Teléfono': payment.phone || 'N/A',
        'Precio por Sesión': payment.pricePerSession,
        'Sesiones Completadas': payment.completedSessions,
        'Total Pendiente': payment.totalPending,
        'Último Pago': payment.lastPaymentDate ? formatDate(payment.lastPaymentDate) : 'N/A',
        'Monto Último Pago': payment.lastPaymentAmount || 0,
        'Tiene Datos Bancarios': payment.hasBankInfo ? 'Sí' : 'No',
        'Estado': payment.status === 'paid' ? 'Pagado' : 'Pendiente'
    }));

    const csv = convertToCSV(csvData);
    const timestamp = new Date().toISOString().split('T')[0];
    downloadCSV(csv, `pagos_psicologos_${timestamp}.csv`);

    Swal.fire({
        icon: 'success',
        title: 'Exportado',
        text: `${allPayments.length} registros exportados exitosamente`,
        timer: 2000,
        showConfirmButton: false
    });
}

function generatePaymentReport() {
    Swal.fire({
        title: 'Generar Reporte',
        text: 'Esta función estará disponible próximamente',
        icon: 'info'
    });
}

// ============= UTILIDADES =============

async function getAuthToken() {
    try {
        if (!auth.currentUser) {
            throw new Error('Usuario no autenticado');
        }
        const token = await auth.currentUser.getIdToken(true);
        authToken = token;
        window.authToken = token;
        return token;
    } catch (error) {
        console.error('Error obteniendo token:', error);
        throw error;
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(amount);
}

function formatDate(date) {
    if (!date) return 'N/A';
    const dateObj = date instanceof Date ? date : new Date(date);
    return new Intl.DateTimeFormat('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }).format(dateObj);
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text?.toString().replace(/[&<>"']/g, m => map[m]) || '';
}

function convertToCSV(data) {
    if (!data.length) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    
    for (const row of data) {
        const values = headers.map(header => {
            const value = row[header]?.toString() || '';
            return `"${value.replace(/"/g, '""')}"`;
        });
        csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
}

function downloadCSV(csv, filename) {
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function logout() {
    const result = await Swal.fire({
        title: '¿Cerrar sesión?',
        text: '¿Estás seguro de que deseas salir?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, salir',
        cancelButtonText: 'Cancelar'
    });
    
    if (result.isConfirmed) {
        try {
            await auth.signOut();
            window.location.href = 'loginAdmin.html';
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo cerrar la sesión'
            });
        }
    }
}

// ============= EXPORTAR FUNCIONES GLOBALES =============
window.toggleBulkPayment = toggleBulkPayment;
window.handleCheckboxChange = handleCheckboxChange;
window.toggleSelectAll = toggleSelectAll;
window.processBulkPayment = processBulkPayment;
window.openPaymentModal = openPaymentModal;
window.closePaymentModal = closePaymentModal;
window.viewBankInfoFromModal = viewBankInfoFromModal;
window.processPayment = processPayment;
window.viewBankInfo = viewBankInfo;
window.closeBankInfoModal = closeBankInfoModal;
window.copyBankInfoToClipboard = copyBankInfoToClipboard;
window.exportToCSV = exportToCSV;
window.generatePaymentReport = generatePaymentReport;
window.logout = logout;
window.getAuthToken = getAuthToken;
window.removeReceipt = removeReceipt;

console.log('✅ Sistema de pagos con comprobantes cargado correctamente');
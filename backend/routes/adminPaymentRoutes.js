// ============================================
// SISTEMA DE PAGOS MANUAL MEJORADO
// Backend: adminPaymentRoutes.js
// ============================================

import express from 'express';
import { verifyAdminToken } from '../middlewares/auth_middleware.js';
import { db } from '../firebase-admin.js';
import { FieldValue } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';

const router = express.Router();

// Configurar email (opcional pero recomendado)
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ===== OBTENER LISTA DE PAGOS PENDIENTES =====
router.get('/psychologists/payments', verifyAdminToken, async (req, res) => {
    try {
        const psychologistsSnapshot = await db.collection('psychologists').get();
        const paymentsData = [];

        for (const psychDoc of psychologistsSnapshot.docs) {
            const psychData = psychDoc.data();
            
            // Obtener citas completadas NO pagadas
            const appointmentsSnapshot = await db.collection('appointments')
                .where('psychologistId', '==', psychDoc.id)
                .where('status', 'in', ['completed', 'rated'])
                .where('paidToPsychologist', '!=', true) // Evita las ya pagadas
                .get();

            let totalEarned = 0;
            let completedSessions = 0;
            const appointmentDetails = [];

            appointmentsSnapshot.forEach(doc => {
                const appointment = doc.data();
                const sessionAmount = appointment.amount || appointment.price || 0;
                
                // Calcular comisión del psicólogo (80% para él, 20% plataforma)
                const psychologistShare = sessionAmount * 0.80;
                
                totalEarned += psychologistShare;
                completedSessions++;
                
                appointmentDetails.push({
                    appointmentId: doc.id,
                    date: appointment.scheduledDateTime?.toDate(),
                    amount: sessionAmount,
                    psychologistShare
                });
            });

            // Verificar si tiene información bancaria
            const bankInfoDoc = await db.collection('bank_info')
                .doc(psychDoc.id)
                .get();

            // Último pago realizado
            const lastPaymentSnapshot = await db.collection('psychologist_payments')
                .where('psychologistId', '==', psychDoc.id)
                .orderBy('paidAt', 'desc')
                .limit(1)
                .get();

            let lastPaymentDate = null;
            let lastPaymentAmount = 0;

            if (!lastPaymentSnapshot.empty) {
                const lastPayment = lastPaymentSnapshot.docs[0].data();
                lastPaymentDate = lastPayment.paidAt?.toDate();
                lastPaymentAmount = lastPayment.amount;
            }

            paymentsData.push({
                psychologistId: psychDoc.id,
                name: psychData.fullName || 'N/A',
                email: psychData.email || 'N/A',
                phone: psychData.phone || 'N/A',
                pricePerSession: psychData.price || 0,
                completedSessions,
                totalPending: totalEarned,
                lastPaymentDate,
                lastPaymentAmount,
                status: totalEarned > 0 ? 'pending' : 'paid',
                hasBankInfo: bankInfoDoc.exists,
                bankInfoComplete: bankInfoDoc.exists && bankInfoDoc.data().clabe,
                appointmentDetails,
                // Alertas útiles
                alerts: {
                    noBankInfo: !bankInfoDoc.exists,
                    highAmount: totalEarned > 5000,
                    oldestUnpaid: appointmentDetails.length > 0 
                        ? appointmentDetails[0].date 
                        : null
                }
            });
        }

        // Ordenar por monto pendiente (mayor a menor)
        paymentsData.sort((a, b) => b.totalPending - a.totalPending);

        res.json({
            success: true,
            payments: paymentsData,
            totalPending: paymentsData.reduce((sum, p) => sum + p.totalPending, 0),
            totalPaid: paymentsData.reduce((sum, p) => sum + (p.lastPaymentAmount || 0), 0),
            psychologistsWithPending: paymentsData.filter(p => p.totalPending > 0).length,
            psychologistsWithoutBankInfo: paymentsData.filter(p => !p.hasBankInfo).length
        });

    } catch (error) {
        console.error('Error obteniendo pagos:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

router.post('/psychologists/payments/mark-paid', verifyAdminToken, async (req, res) => {
    try {
        const { 
            psychologistId, 
            amount, 
            paymentMethod, 
            reference,
            notes,
            paymentDate,
            receipt 
        } = req.body;

        // Validaciones
        if (!psychologistId || !amount) {
            return res.status(400).json({ 
                error: 'psychologistId y amount son requeridos' 
            });
        }

        if (amount <= 0) {
            return res.status(400).json({ 
                error: 'El monto debe ser mayor a cero' 
            });
        }
        if (!receipt || !receipt.base64) {
            return res.status(400).json({ 
                error: 'Debes subir el comprobante de pago',
                suggestion: 'Sube una imagen o PDF del comprobante bancario'
            });
        }
        const base64Size = receipt.base64.length * 0.75; 
        const maxSize = 8 * 1024 * 1024; 
        
        if (base64Size > maxSize) {
            return res.status(400).json({ 
                error: 'El comprobante es demasiado grande',
                suggestion: 'Reduce el tamaño del archivo. La imagen se comprimió pero sigue siendo muy grande.',
                maxSize: '8MB'
            });
        }
        
        console.log('📎 Comprobante recibido:', {
            fileName: receipt.fileName,
            fileType: receipt.fileType,
            sizeKB: (base64Size / 1024).toFixed(2)
        });

        // Verificar que el psicólogo existe
        const psychDoc = await db.collection('psychologists').doc(psychologistId).get();
        if (!psychDoc.exists) {
            return res.status(404).json({ error: 'Psicólogo no encontrado' });
        }

        const psychData = psychDoc.data();

        // Verificar información bancaria
        const bankInfoDoc = await db.collection('bank_info').doc(psychologistId).get();
        if (!bankInfoDoc.exists) {
            return res.status(400).json({ 
                error: 'El psicólogo no tiene información bancaria registrada',
                suggestion: 'Solicita al psicólogo que registre sus datos bancarios'
            });
        }

        // Obtener citas pendientes de pago
        const appointmentsSnapshot = await db.collection('appointments')
            .where('psychologistId', '==', psychologistId)
            .where('status', 'in', ['completed', 'rated'])
            .where('paidToPsychologist', '!=', true)
            .get();

        if (appointmentsSnapshot.empty) {
            return res.status(400).json({ 
                error: 'No hay citas pendientes de pago para este psicólogo' 
            });
        }

        // Calcular total real
        let calculatedTotal = 0;
        appointmentsSnapshot.forEach(doc => {
            const app = doc.data();
            const sessionAmount = app.amount || app.price || 0;
            calculatedTotal += sessionAmount * 0.80;
        });

        // Advertencia si el monto no coincide
        const amountDifference = Math.abs(calculatedTotal - amount);
        if (amountDifference > 0.01) {
            console.warn(`Diferencia en monto: Calculado ${calculatedTotal}, Reportado ${amount}`);
        }

        // Crear registro de pago CON COMPROBANTE
        const paymentRecord = {
            psychologistId,
            psychologistName: psychData.fullName,
            psychologistEmail: psychData.email,
            amount,
            calculatedAmount: calculatedTotal,
            paymentMethod: paymentMethod || 'bank_transfer',
            reference: reference || 'N/A',
            notes: notes || '',
            paidAt: paymentDate ? new Date(paymentDate) : FieldValue.serverTimestamp(),
            registeredAt: FieldValue.serverTimestamp(),
            paidBy: req.userId,
            appointmentIds: appointmentsSnapshot.docs.map(doc => doc.id),
            appointmentsCount: appointmentsSnapshot.size,
            status: 'completed',
            bankInfo: {
                bankName: bankInfoDoc.data().bankName,
                clabe: bankInfoDoc.data().clabe,
                accountHolder: bankInfoDoc.data().accountHolderName
            },
            
            receipt: {
                base64: receipt.base64,
                fileName: receipt.fileName || 'comprobante.jpg',
                fileType: receipt.fileType || 'image/jpeg',
                fileSize: receipt.fileSize || 0,
                uploadedAt: receipt.uploadedAt || new Date().toISOString(),
                uploadedBy: req.userId
            }
        };

        const paymentRef = await db.collection('psychologist_payments').add(paymentRecord);

        // Marcar todas las citas como pagadas
        const batch = db.batch();
        
        appointmentsSnapshot.docs.forEach(doc => {
            const appData = doc.data();
            const sessionAmount = appData.amount || appData.price || 0;
            const psychologistShare = sessionAmount * 0.80;
            
            batch.update(doc.ref, {
                paidToPsychologist: true,
                psychologistPaymentId: paymentRef.id,
                psychologistPaidAt: FieldValue.serverTimestamp(),
                psychologistShareAmount: psychologistShare,
                platformFeeAmount: sessionAmount * 0.20,
                // NUEVO: Referencia al comprobante
                hasReceipt: true
            });
        });

        // Actualizar estadísticas del psicólogo
        batch.update(psychDoc.ref, {
            totalEarnings: FieldValue.increment(amount),
            lastPaymentDate: FieldValue.serverTimestamp(),
            lastPaymentAmount: amount,
            totalPayments: FieldValue.increment(1),
            lastPaymentId: paymentRef.id 
        });

        await batch.commit();

        // Enviar notificación 
        try {
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: psychData.email,
                subject: '💰 Pago Procesado - Aurora',
                html: `
                    <h2>¡Pago Procesado Exitosamente!</h2>
                    <p>Hola ${psychData.fullName},</p>
                    <p>Te informamos que tu pago ha sido procesado:</p>
                    <ul>
                        <li><strong>Monto:</strong> $${amount.toFixed(2)} MXN</li>
                        <li><strong>Sesiones:</strong> ${appointmentsSnapshot.size}</li>
                        <li><strong>Referencia:</strong> ${reference || 'N/A'}</li>
                        <li><strong>Método:</strong> ${paymentMethod === 'bank_transfer' ? 'Transferencia Bancaria' : 'Otro'}</li>
                        <li><strong>Comprobante:</strong> Adjunto disponible</li>
                    </ul>
                    <p>El depósito debería reflejarse en tu cuenta en las próximas 24-48 horas.</p>
                    <p>Puedes ver el comprobante de pago en tu panel de psicólogo.</p>
                    <p>Gracias por ser parte de Aurora.</p>
                `
            });
        } catch (emailError) {
            console.warn('No se pudo enviar email de confirmación:', emailError.message);
        }

        res.json({
            success: true,
            message: 'Pago registrado exitosamente con comprobante',
            payment: {
                paymentId: paymentRef.id,
                amount,
                appointmentsPaid: appointmentsSnapshot.size,
                psychologistName: psychData.fullName,
                reference,
                hasReceipt: true
            }
        });

    } catch (error) {
        console.error('Error registrando pago:', error);
        res.status(500).json({
            error: 'Error al registrar el pago',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Obtener comprobante de pago
router.get('/psychologists/payments/:paymentId/receipt', verifyAdminToken, async (req, res) => {
    try {
        const { paymentId } = req.params;

        const paymentDoc = await db.collection('psychologist_payments').doc(paymentId).get();

        if (!paymentDoc.exists) {
            return res.status(404).json({ error: 'Pago no encontrado' });
        }

        const paymentData = paymentDoc.data();

        if (!paymentData.receipt || !paymentData.receipt.base64) {
            return res.status(404).json({ error: 'Este pago no tiene comprobante adjunto' });
        }

        res.json({
            success: true,
            receipt: {
                base64: paymentData.receipt.base64,
                fileName: paymentData.receipt.fileName,
                fileType: paymentData.receipt.fileType,
                fileSize: paymentData.receipt.fileSize,
                uploadedAt: paymentData.receipt.uploadedAt
            },
            payment: {
                amount: paymentData.amount,
                reference: paymentData.reference,
                paidAt: paymentData.paidAt?.toDate(),
                psychologistName: paymentData.psychologistName
            }
        });

    } catch (error) {
        console.error('Error obteniendo comprobante:', error);
        res.status(500).json({ error: 'Error al obtener el comprobante' });
    }
});

//Comprobante para psicologo
router.get('/psychologist/my-payments/:paymentId/receipt', async (req, res) => {
    try {
        const { paymentId } = req.params;
        const psychologistId = req.userId; 

        const paymentDoc = await db.collection('psychologist_payments').doc(paymentId).get();

        if (!paymentDoc.exists) {
            return res.status(404).json({ error: 'Pago no encontrado' });
        }

        const paymentData = paymentDoc.data();

        // Verificar que el pago pertenece al psicólogo autenticado
        if (paymentData.psychologistId !== psychologistId) {
            return res.status(403).json({ error: 'No tienes permiso para ver este comprobante' });
        }

        if (!paymentData.receipt || !paymentData.receipt.base64) {
            return res.status(404).json({ error: 'Este pago no tiene comprobante adjunto' });
        }

        res.json({
            success: true,
            receipt: {
                base64: paymentData.receipt.base64,
                fileName: paymentData.receipt.fileName,
                fileType: paymentData.receipt.fileType,
                uploadedAt: paymentData.receipt.uploadedAt
            },
            payment: {
                amount: paymentData.amount,
                reference: paymentData.reference,
                paidAt: paymentData.paidAt?.toDate()
            }
        });

    } catch (error) {
        console.error('Error obteniendo comprobante:', error);
        res.status(500).json({ error: 'Error al obtener el comprobante' });
    }
});

//Generear reporte de pago
router.get('/psychologists/:psychologistId/payment-report', verifyAdminToken, async (req, res) => {
    try {
        const { psychologistId } = req.params;
        const { startDate, endDate } = req.query;

        // Obtener pagos en el rango de fechas
        let query = db.collection('psychologist_payments')
            .where('psychologistId', '==', psychologistId);

        if (startDate) {
            query = query.where('paidAt', '>=', new Date(startDate));
        }
        if (endDate) {
            query = query.where('paidAt', '<=', new Date(endDate));
        }

        const paymentsSnapshot = await query.orderBy('paidAt', 'desc').get();

        const payments = paymentsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            paidAt: doc.data().paidAt?.toDate()
        }));

        const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

        res.json({
            success: true,
            psychologistId,
            period: {
                start: startDate || 'Inicio',
                end: endDate || 'Ahora'
            },
            payments,
            summary: {
                totalPayments: payments.length,
                totalAmount: totalPaid,
                averagePayment: payments.length > 0 ? totalPaid / payments.length : 0
            }
        });

    } catch (error) {
        console.error('Error generando reporte:', error);
        res.status(500).json({ error: 'Error generando reporte' });
    }
});

// Pagos masivos
router.post('/psychologists/payments/bulk-pay', verifyAdminToken, async (req, res) => {
    try {
        const { payments } = req.body; 

        if (!Array.isArray(payments) || payments.length === 0) {
            return res.status(400).json({ error: 'Se requiere un array de pagos' });
        }

        const results = [];
        const errors = [];

        for (const payment of payments) {
            try {
                
                const response = await fetch(`${req.protocol}://${req.get('host')}/api/admin/psychologists/payments/mark-paid`, {
                    method: 'POST',
                    headers: {
                        'Authorization': req.headers.authorization,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payment)
                });

                const data = await response.json();
                
                if (response.ok) {
                    results.push({ psychologistId: payment.psychologistId, success: true, data });
                } else {
                    errors.push({ psychologistId: payment.psychologistId, error: data.error });
                }
            } catch (error) {
                errors.push({ psychologistId: payment.psychologistId, error: error.message });
            }
        }

        res.json({
            success: true,
            processed: results.length,
            failed: errors.length,
            results,
            errors
        });

    } catch (error) {
        console.error('Error en pago masivo:', error);
        res.status(500).json({ error: 'Error procesando pagos masivos' });
    }
});

export default router;
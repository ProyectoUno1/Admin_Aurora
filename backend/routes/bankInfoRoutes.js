// backend/routes/bankInfoRoutes.js
// Rutas para gestionar información bancaria de psicólogos

import express from 'express';
import { verifyAdminToken, verifySelfOrAdmin } from '../middlewares/auth_middleware.js';
import { db } from '../firebase-admin.js';
import admin from 'firebase-admin';

const router = express.Router();

// IMPORTANTE: Las rutas más específicas deben ir PRIMERO

// Obtiene información bancaria completa (ADMIN) - Ruta más específica primero
router.get('/admin/bank-info/:psychologistId', verifyAdminToken, async (req, res) => {
    try {
        const { psychologistId } = req.params;

        const bankInfoDoc = await db.collection('bank_info')
            .doc(psychologistId)
            .get();

        if (!bankInfoDoc.exists) {
            return res.status(404).json({ 
                error: 'No se encontró información bancaria',
                bankInfo: null 
            });
        }

        // Obtener también datos del psicólogo
        const psychologistDoc = await db.collection('psychologists')
            .doc(psychologistId)
            .get();

        res.json({ 
            success: true,
            bankInfo: {
                id: bankInfoDoc.id,
                ...bankInfoDoc.data()
            },
            psychologist: psychologistDoc.exists ? {
                name: psychologistDoc.data().fullName,
                email: psychologistDoc.data().email,
                pendingPayment: psychologistDoc.data().pendingPayment || 0
            } : null
        });

    } catch (error) {
        console.error('Error obteniendo información bancaria:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Obtiene información bancaria de todos los psicólogos con pagos pendientes
router.get('/admin/bank-info-for-payment', verifyAdminToken, async (req, res) => {
    try {
        // Obtener psicólogos con pagos pendientes
        const psychologistsSnapshot = await db.collection('psychologists')
            .where('paymentStatus', '==', 'pending')
            .where('pendingPayment', '>', 0)
            .get();

        const results = [];

        // Para cada psicólogo, obtener su información bancaria
        for (const psychDoc of psychologistsSnapshot.docs) {
            const psychData = psychDoc.data();
            const bankInfoDoc = await db.collection('bank_info')
                .doc(psychDoc.id)
                .get();

            results.push({
                psychologistId: psychDoc.id,
                psychologist: {
                    name: psychData.fullName,
                    email: psychData.email,
                    pendingPayment: psychData.pendingPayment || 0,
                    lastPaymentDate: psychData.lastPaymentDate
                },
                bankInfo: bankInfoDoc.exists ? {
                    accountHolderName: bankInfoDoc.data().accountHolderName,
                    bankName: bankInfoDoc.data().bankName,
                    accountType: bankInfoDoc.data().accountType,
                    clabe: bankInfoDoc.data().clabe,
                    isInternational: bankInfoDoc.data().isInternational,
                    swiftCode: bankInfoDoc.data().swiftCode
                } : null
            });
        }

        res.json({
            success: true,
            count: results.length,
            data: results
        });

    } catch (error) {
        console.error('Error obteniendo información bancaria para pagos:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Elimina información bancaria
router.delete('/admin/bank-info/:psychologistId', verifyAdminToken, async (req, res) => {
    try {
        const { psychologistId } = req.params;

        await db.collection('bank_info').doc(psychologistId).delete();

        res.json({
            success: true,
            message: 'Información bancaria eliminada correctamente'
        });

    } catch (error) {
        console.error('Error eliminando información bancaria:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Obtiene la información bancaria de un psicólogo (ruta genérica al final)
router.get('/bank-info/:psychologistId', async (req, res, next) => {
    try {
        const { psychologistId } = req.params;

        // Buscar información bancaria
        const bankInfoDoc = await db.collection('bank_info')
            .doc(psychologistId)
            .get();

        if (!bankInfoDoc.exists) {
            return res.status(404).json({ 
                error: 'No se encontró información bancaria',
                bankInfo: null 
            });
        }

        res.json({ 
            success: true,
            bankInfo: {
                id: bankInfoDoc.id,
                ...bankInfoDoc.data()
            }
        });

    } catch (error) {
        console.error('Error obteniendo información bancaria:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

export default router;
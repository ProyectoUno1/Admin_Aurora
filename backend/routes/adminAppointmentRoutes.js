// backend/routes/adminAppointmentRoutes.js - CORREGIDO

import express from 'express';
const router = express.Router();
import { verifyAdminToken } from '../middlewares/auth_middleware.js'; 
import { db } from '../firebase-admin.js'; 
import stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

// Obtener lista de citas para el admin
router.get('/appointments', verifyAdminToken, async (req, res) => {
    try {
        const appointmentsSnapshot = await db.collection('appointments') 
            .orderBy('scheduledDateTime', 'desc') 
            .limit(100) 
            .get(); 
            
        const appointments = [];

        for (const doc of appointmentsSnapshot.docs) {
            const data = doc.data();
            
            // Obtener datos de Patient y Psychologist en paralelo
            const [patientDoc, psychologistDoc] = await Promise.all([
                db.collection('patients').doc(data.patientId).get(),
                db.collection('psychologists').doc(data.psychologistId).get()
            ]);

            // Construir el objeto de la cita con TODOS los campos
            const appointment = {
                id: doc.id,
                
                // Datos de la cita
                scheduledDateTime: data.scheduledDateTime ? data.scheduledDateTime.toDate() : null,
                type: data.type,
                status: data.status,
                paymentIntentId: data.paymentIntentId || null,
                amount: data.amountPaid || data.amount || 0,
                
                // 🆕 CAMPOS FALTANTES
                createdAt: data.createdAt ? data.createdAt.toDate() : null,
                isPaid: data.isPaid || false,
                paymentType: data.paymentType || 'one_time',
                cancellationReason: data.cancellationReason || null,
                cancelledAt: data.cancelledAt ? data.cancelledAt.toDate() : null,
                
                // Datos del paciente
                patientId: data.patientId,
                patientName: patientDoc.exists ? (patientDoc.data().username || 'N/A') : 'Paciente Eliminado',
                patientEmail: patientDoc.exists ? (patientDoc.data().email || 'N/A') : 'N/A',
                
                // Datos del psicólogo
                psychologistId: data.psychologistId,
                psychologistName: psychologistDoc.exists ? (psychologistDoc.data().fullName || 'N/A') : 'Psicólogo Eliminado',
                psychologistEmail: psychologistDoc.exists ? (psychologistDoc.data().email || 'N/A') : 'N/A',
            };
            
            appointments.push(appointment);
        }

        res.json({ appointments });

    } catch (error) {
        console.error('Error al obtener la lista de citas:', error);
        res.status(500).json({ error: 'Error interno del servidor al obtener citas', details: error.message });
    }
});

// Ruta para procesar el reembolso
router.post('/stripe/refund-session', verifyAdminToken, async (req, res) => {
    const { sessionId, paymentIntentId } = req.body;

    if (!paymentIntentId) {
        return res.status(400).json({ error: 'paymentIntentId es requerido para el reembolso.' });
    }

    try {
        const refund = await stripeClient.refunds.create({
            payment_intent: paymentIntentId,
        });

        await db.collection('appointments').doc(sessionId).update({
            status: 'refunded',
            updatedAt: new Date(),
            refundId: refund.id,
            refundedAt: new Date(),
        });
        
        res.json({ message: 'Reembolso procesado con éxito.', refundId: refund.id });

    } catch (error) {
        console.error('Error al procesar reembolso con Stripe:', error);
        res.status(500).json({ error: 'Error al procesar el reembolso con Stripe.', details: error.message });
    }
});

// Endpoint para graficas de citas
router.get('/appointments/history', verifyAdminToken, async (req, res) => {
    try {
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
        twelveMonthsAgo.setDate(1);
        twelveMonthsAgo.setHours(0, 0, 0, 0);

        const snapshot = await db.collection('appointments')
            .where('scheduledDateTime', '>=', twelveMonthsAgo)
            .get();

        const monthlyCounts = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            const timestamp = data.scheduledDateTime;

            if (timestamp && timestamp.toDate) {
                const date = timestamp.toDate();
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const key = `${year}-${month}`;

                monthlyCounts[key] = (monthlyCounts[key] || 0) + 1;
            }
        });

        const result = [];
        let dateCursor = new Date();

        for (let i = 0; i < 12; i++) {
            const year = dateCursor.getFullYear();
            const month = String(dateCursor.getMonth() + 1).padStart(2, '0');
            const key = `${year}-${month}`;
            const count = monthlyCounts[key] || 0;

            result.unshift({ date: key, count: count });
            dateCursor.setMonth(dateCursor.getMonth() - 1);
        }

        res.json(result);

    } catch (error) {
        console.error('Error al obtener el historial de citas:', error);
        res.status(500).json({ error: 'Error interno del servidor al obtener datos históricos.', details: error.message });
    }
});

export default router;
// backend/routes/adminStripeRoutes.js - SIMPLIFICADO (Stripe maneja los emails)

import express from 'express';
import { db } from '../firebase-admin.js'; 
import { verifyAdminToken } from '../middlewares/auth_middleware.js'; 
import stripe from "stripe";
import { FieldValue } from 'firebase-admin/firestore';

const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);
const adminStripeRouter = express.Router();

// Endpoint para procesar reembolso
adminStripeRouter.post("/refund-session", verifyAdminToken, async (req, res) => {
    const { sessionId, paymentIntentId } = req.body; 

    if (!sessionId || !paymentIntentId) {
        return res.status(400).json({ 
            error: "sessionId (ID de la Cita) y paymentIntentId son requeridos." 
        });
    }

    try {
        console.log('🔄 Iniciando proceso de reembolso para cita:', sessionId);
        
        // 1. Verificar que la cita existe
        const appointmentRef = db.collection('appointments').doc(sessionId);
        const appointmentDoc = await appointmentRef.get();

        if (!appointmentDoc.exists) {
            return res.status(404).json({ error: "Cita no encontrada." });
        }

        const appointmentData = appointmentDoc.data();

        // 2. Verificar que no esté ya reembolsada
        if (appointmentData.status === 'refunded') {
            return res.status(400).json({ 
                error: "Esta cita ya fue reembolsada previamente.",
                refundId: appointmentData.refundId 
            });
        }

        // 3. Crear el reembolso en Stripe
        console.log('💳 Procesando reembolso en Stripe...');
        const refund = await stripeClient.refunds.create({
            payment_intent: paymentIntentId,
            reason: 'requested_by_customer',
            metadata: {
                appointmentId: sessionId,
                psychologistId: appointmentData.psychologistId,
                patientId: appointmentData.patientId,
                refundedBy: 'admin'
            }
        });

        console.log('✅ Reembolso creado en Stripe:', refund.id);

        // 4. Actualizar el estado de la cita en Firebase
        await appointmentRef.update({
            status: 'refunded',
            paymentStatus: 'refunded',
            refundId: refund.id,
            refundDate: FieldValue.serverTimestamp(),
            refundAmount: refund.amount,
            refundStatus: refund.status,
            refundReason: 'requested_by_customer',
            refundedAt: FieldValue.serverTimestamp()
        });

        console.log('✅ Cita actualizada en Firebase');
        console.log('📧 Stripe enviará el recibo automáticamente al cliente');

        // 5. Respuesta exitosa
        res.status(200).json({
            message: "Reembolso procesado exitosamente. Stripe enviará el recibo al cliente automáticamente.",
            refundId: refund.id,
            amount: refund.amount / 100, // Convertir de centavos a pesos
            currency: refund.currency.toUpperCase(),
            status: refund.status,
            newAppointmentStatus: 'refunded',
            emailSent: true, // Stripe se encarga automáticamente
            note: "El cliente recibirá un email de Stripe con el recibo del reembolso"
        });

    } catch (error) {
        console.error('❌ Error en /refund-session:', error);
        
        let errorMessage = 'Error al procesar el reembolso.';
        let statusCode = 500;
        
        // Manejar errores específicos de Stripe
        if (error.type === 'StripeInvalidRequestError') {
            errorMessage = error.message;
            statusCode = 400;
            
            if (error.code === 'charge_already_refunded') {
                errorMessage = 'Este pago ya fue reembolsado previamente.';
            }
        } else if (error.type === 'StripeConnectionError') {
            errorMessage = 'Error de conexión con Stripe. Intenta nuevamente.';
            statusCode = 503;
        }

        res.status(statusCode).json({
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

export default adminStripeRouter;
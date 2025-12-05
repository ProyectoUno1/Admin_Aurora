import express from 'express';
import { verifyAdminToken, verifyFirebaseToken } from '../middlewares/auth_middleware.js'; 
import admin from 'firebase-admin';
import { db } from '../firebase-admin.js';
const router = express.Router();
const adminMiddleware = [verifyAdminToken]; 


//Historial de psicologos
router.get('/psychologists/history', ...adminMiddleware, async (req, res) => {
    try {
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
        twelveMonthsAgo.setDate(1);
        twelveMonthsAgo.setHours(0, 0, 0, 0);

        const snapshot = await db.collection('psychologists')
            .where('createdAt', '>=', twelveMonthsAgo) 
            .get();

        const monthlyCounts = {};
        snapshot.forEach(doc => {
            const timestamp = doc.data().createdAt;  
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
            result.unshift({ date: key, count: monthlyCounts[key] || 0 });
            dateCursor.setMonth(dateCursor.getMonth() - 1);
        }

        res.json(result);

    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor al obtener datos históricos.' });
    }
});

//Historial para pacientes con suscripciones
router.get('/patients/history', ...adminMiddleware, async (req, res) => {
    try {
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
        twelveMonthsAgo.setDate(1);
        twelveMonthsAgo.setHours(0, 0, 0, 0);

        const snapshot = await db.collection('patients')
            .where('isPremium', '==', true)
            .where('created_at', '>=', twelveMonthsAgo) 
            .get();

        const monthlyCounts = {};
        snapshot.forEach(doc => {
            const timestamp = doc.data().created_at;
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
            result.unshift({ date: key, count: monthlyCounts[key] || 0 });
            dateCursor.setMonth(dateCursor.getMonth() - 1);
        }
        
        res.json(result);

    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor al obtener el historial de pacientes.' });
    }
});

// Historial para citas agendadas
router.get('/appointments/history', ...adminMiddleware, async (req, res) => {
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
            const timestamp = doc.data().scheduledDateTime;

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
            result.unshift({ date: key, count: monthlyCounts[key] || 0 });
            dateCursor.setMonth(dateCursor.getMonth() - 1);
        }

        res.json(result);

    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor al obtener datos históricos.' });
    }
});


export default router;
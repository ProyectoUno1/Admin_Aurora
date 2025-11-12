import express from 'express';
const router = express.Router();
import { verifyAdminToken } from '../middlewares/auth_middleware.js'; 
import { db } from '../firebase-admin.js'; 


// Obtener historial de pacientes premium por mes para graficas
router.get('/patients/history', verifyAdminToken, async (req, res) => {
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
            const data = doc.data();
            const timestamp = data.created_at;

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
        res.status(500).json({ error: 'Error interno del servidor al obtener el historial de pacientes.' });
    }
});


//Obtener todos los pacientes
router.get('/patients', verifyAdminToken, async (req, res) => {
    try {
        console.log('Admin solicitando lista de pacientes...');
        
        const patientsSnapshot = await db.collection('patients').get();
        const patients = [];

        patientsSnapshot.forEach(doc => {
            const data = doc.data();
            patients.push({
                uid: doc.id,
                username: data.username || 'N/A',
                email: data.email,
                phone_number: data.phone_number || 'N/A',
                isPremium: !!data.isPremium,
                created_at: data.created_at ? data.created_at.toDate().toLocaleDateString() : 'N/A'
            });
        });

        res.json({ patients });
    } catch (error) {
        console.error('Error al obtener la lista de pacientes:', error);
        res.status(500).json({ error: 'Error interno del servidor al obtener pacientes' });
    }
});


// Obtener detalles de un paciente por UID
router.get('/patients/:uid', verifyAdminToken, async (req, res) => {
    const { uid } = req.params;
    try {
        const patientDoc = await db.collection('patients').doc(uid).get();

        if (!patientDoc.exists) {
            return res.status(404).json({ error: 'Paciente no encontrado.' });
        }

        const data = patientDoc.data();
        const patient = {
            uid: patientDoc.id,
            username: data.username || 'N/A',
            email: data.email,
            phone_number: data.phone_number || 'N/A',
            isPremium: !!data.isPremium,
            created_at: data.created_at ? data.created_at.toDate().toLocaleDateString() : 'N/A'
        };

        res.json({ patient });
    } catch (error) {
        console.error(`Error al obtener detalles del paciente ${uid}:`, error);
        res.status(500).json({ error: 'Error interno del servidor al obtener detalles.' });
    }
});


//Actualizar un paciente por UID
router.put('/patients/:uid', verifyAdminToken, async (req, res) => {
    const { uid } = req.params;
    const updates = req.body;

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No se proporcionaron campos para actualizar.' });
    }

    try {
        const patientRef = db.collection('patients').doc(uid);
        
        const doc = await patientRef.get();
        if (!doc.exists) {
            return res.status(404).json({ error: 'Paciente no encontrado.' });
        }
        
        const allowedUpdates = {};
        
        if (updates.hasOwnProperty('username')) {
            if (!updates.username || updates.username.trim() === '') {
                return res.status(400).json({ error: 'El nombre de usuario no puede estar vacío.' });
            }
            allowedUpdates.username = updates.username.trim();
        }

        if (updates.hasOwnProperty('phone_number')) {
            allowedUpdates.phone_number = updates.phone_number;
        }

        if (updates.hasOwnProperty('isPremium')) {
            allowedUpdates.isPremium = updates.isPremium === true; 
        }

        await patientRef.update(allowedUpdates);

        res.json({ message: 'Paciente actualizado con éxito', uid });

    } catch (error) {
        console.error(`Error al actualizar paciente ${uid}:`, error);
        res.status(500).json({ error: 'Error interno del servidor al actualizar paciente.' });
    }
});


//Eliminar un paciente por UID
router.delete('/patients/:uid', verifyAdminToken, async (req, res) => {
    const { uid } = req.params;

    try {
        const patientRef = db.collection('patients').doc(uid);
        const doc = await patientRef.get();
        if (!doc.exists) {
            return res.status(404).json({ error: 'Paciente no encontrado para eliminar.' });
        }
        
        await patientRef.delete();
        
        console.log(`Paciente ${uid} eliminado correctamente.`);

        res.json({ message: 'Paciente eliminado con éxito', uid });

    } catch (error) {
        console.error(`Error al eliminar paciente ${uid}:`, error);
        res.status(500).json({ error: 'Error interno del servidor al eliminar paciente.' });
    }
});


export default router;
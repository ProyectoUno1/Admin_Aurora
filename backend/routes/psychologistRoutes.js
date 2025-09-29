import express from 'express';
import { verifyFirebaseToken } from '../middlewares/auth_middleware.js';
import admin from 'firebase-admin';
import { db } from '../firebase-admin.js';

const router = express.Router();

const verifyAdminPrivileges = async (req, res, next) => {
  try {
    const userRecord = await admin.auth().getUser(req.userId);
    if (!userRecord.customClaims || !userRecord.customClaims.admin) {
      return res.status(403).json({ error: 'No tienes privilegios de administrador' });
    }
    next();
  } catch (error) {
    console.error('Error verificando privilegios de admin:', error);
    return res.status(500).json({ error: 'Error verificando privilegios' });
  }
};

// Obtener todos los psicólogos con información profesional
router.get('/psychologists', verifyFirebaseToken, verifyAdminPrivileges, async (req, res) => {
  try {
    const psychologistsRef = db.collection('psychologists');
    const psychologistsSnapshot = await psychologistsRef.get();
    
    const psychologists = psychologistsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.json(psychologists);
  } catch (error) {
    console.error('Error obteniendo psicólogos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener detalles de un solo psicólogo
router.get('/psychologists/:id', verifyFirebaseToken, verifyAdminPrivileges, async (req, res) => {
  try {
    const psychologistId = req.params.id;
    const psychologistRef = db.collection('psychologists').doc(psychologistId);
    const psychologistDoc = await psychologistRef.get();
    
    if (!psychologistDoc.exists) {
      return res.status(404).json({ error: 'Psicólogo no encontrado' });
    }

    const psychologist = {
      id: psychologistId,
      ...psychologistDoc.data()
    };
    
    res.json(psychologist);
  } catch (error) {
    console.error('Error obteniendo detalles del psicólogo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener estadísticas de psicólogos
router.get('/stats/psychologists', verifyFirebaseToken, verifyAdminPrivileges, async (req, res) => {
  try {
    const psychologistsRef = db.collection('psychologists');
    const snapshot = await psychologistsRef.get();
    
    const stats = {
      total: 0,
      active: 0,
      pending: 0,
      rejected: 0,
      inactive: 0
    };

    snapshot.forEach(doc => {
      const data = doc.data();
      stats.total++;
      
      switch (data.status) {
        case 'ACTIVE':
          stats.active++;
          break;
        case 'PENDING':
          stats.pending++;
          break;
        case 'REJECTED':
          stats.rejected++;
          break;
        case 'INACTIVE':
          stats.inactive++;
          break;
        default:
          stats.inactive++;
      }
    });
    res.json(stats);
  } catch (error) {
    console.error('Error calculando estadísticas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar el estado de un psicólogo (a "Activo", "Rechazado", etc.)
router.put('/psychologists/:id/status', verifyFirebaseToken, verifyAdminPrivileges, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const validStatuses = ['ACTIVE', 'INACTIVE', 'PENDING', 'REJECTED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const psychologistRef = db.collection('psychologists').doc(id);
    const psychologistDoc = await psychologistRef.get();
    if (!psychologistDoc.exists) {
      console.error(`Error: Documento de psicólogo con ID ${id} no encontrado.`);
      return res.status(404).json({ error: 'Psicólogo no encontrado' });
    }

    const updateData = {
      status: status,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      adminUid: req.userId
    };

    if (adminNotes) {
      updateData.adminNotes = adminNotes;
    }

    if (status === 'ACTIVE') {
      updateData.validatedAt = admin.firestore.FieldValue.serverTimestamp();
    }
    
    // Si el estado cambia a INACTIVE, también se actualiza isAvailable a false
    if (status === 'INACTIVE') {
      updateData.isAvailable = false;
    }

    await psychologistRef.update(updateData);

    res.json({ 
      message: 'Estado actualizado correctamente',
      psychologistId: id,
      newStatus: status
    });
  } catch (error) {
    console.error('Error actualizando estado del psicólogo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar un psicólogo
router.delete('/:id', verifyFirebaseToken, verifyAdminPrivileges, async (req, res) => {
  try {
    const psychologistId = req.params.id;

    // 1. Eliminar el documento de la colección 'psychologists'
    await db.collection('psychologists').doc(psychologistId).delete();

    // 2. Eliminar el usuario de Firebase Authentication
    try {
        await admin.auth().deleteUser(psychologistId);
    } catch (authError) {
        console.warn(`No se pudo eliminar el usuario de Auth con UID ${psychologistId}. Puede que no exista.`, authError.message);
    }
    
    res.status(200).json({ message: 'Psicólogo y cuenta de usuario eliminados correctamente.' });
  } catch (error) {
    console.error('Error al eliminar psicólogo:', error);
    res.status(500).json({ error: 'Error interno del servidor al eliminar.' });
  }
});

// Actualiza precio de sesions del psicologo
router.put('/psychologists/:id/price', verifyFirebaseToken, verifyAdminPrivileges, async (req, res) => {
  try {
    const { id } = req.params;
    const { price } = req.body;

    // Validar el precio
    if (price === undefined || price === null) {
      return res.status(400).json({ error: 'El precio es requerido' });
    }

    const priceNumber = parseFloat(price);
    if (isNaN(priceNumber) || priceNumber < 0) {
      return res.status(400).json({ error: 'El precio debe ser un número válido mayor o igual a 0' });
    }

    // Verificar que el psicólogo existe
    const psychologistRef = db.collection('psychologists').doc(id);
    const psychologistDoc = await psychologistRef.get();

    if (!psychologistDoc.exists) {
      return res.status(404).json({ error: 'Psicólogo no encontrado' });
    }

    // Actualizar en la base de datos
    await psychologistRef.update({
      price: priceNumber,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      adminUid: req.userId
    });

    res.json({ 
      success: true, 
      message: 'Precio actualizado correctamente',
      price: priceNumber
    });

  } catch (error) {
    console.error('Error actualizando precio:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});
export default router;
import express from 'express';
import { auth, db } from '../firebase-admin.js';

const router = express.Router();

// Middleware para verificar token Firebase
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No authorization token provided' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verificando token:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

//Verificar credenciales y obtener información del admin
router.post('/verify', verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    
    // Verificar si es administrador
    const userRecord = await auth.getUser(uid);
    const customClaims = userRecord.customClaims || {};
    
    if (!customClaims.admin) {
      return res.status(403).json({ error: 'Acceso denegado. Se requieren privilegios de administrador.' });
    }

    // Obtener información adicional del administrador
    const adminDoc = await db.collection('administrators').doc(uid).get();
    
    if (!adminDoc.exists) {
      return res.status(404).json({ error: 'Administrador no encontrado' });
    }

    const adminData = adminDoc.data();
    
    console.log('Admin login exitoso:', uid);
    res.status(200).json({
      message: 'Login successful',
      admin: {
        uid: uid,
        email: userRecord.email,
        createdAt: adminData.createdAt,
        isAdmin: true
      }
    });

  } catch (error) {
    console.error(' Error verificando admin:', error);
    res.status(500).json({ error: 'Failed to verify admin', details: error.message });
  }
});

//Obtener perfil del admin logueado
router.get('/profile', verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    
    const adminDoc = await db.collection('administrators').doc(uid).get();
    
    if (!adminDoc.exists) {
      return res.status(404).json({ error: 'Administrador no encontrado' });
    }

    const adminData = adminDoc.data();
    
    res.status(200).json({
      uid: uid,
      email: req.user.email,
      createdAt: adminData.createdAt.toDate().getTime(),
      isAdmin: req.user.admin || false
    });

  } catch (error) {
    console.error('Error obteniendo perfil de admin:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

export default router;
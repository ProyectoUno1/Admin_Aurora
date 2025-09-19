import express from 'express';
import { auth, db } from '../firebase-admin.js';

const router = express.Router();

// Middleware para verificar que el usuario es admin
const requireAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No authorization token provided' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    
    // Verificar que tiene custom claims de admin
    if (!decodedToken.admin) {
      return res.status(403).json({ error: 'Acceso denegado. Se requieren privilegios de administrador.' });
    }
    
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verificando admin token:', error);
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

router.post('/', requireAdmin, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y password son requeridos' });
  }

  try {
    const userRecord = await auth.createUser({
      email: email,
      password: password,
    });
    
    await auth.setCustomUserClaims(userRecord.uid, { admin: true });

    await db.collection('administrators').doc(userRecord.uid).set({
      email: userRecord.email,
      uid: userRecord.uid,
      createdAt: new Date(),
      createdBy: req.user.uid,
    });

    console.log('Nuevo administrador registrado:', userRecord.uid, 'por:', req.user.email);
    res.status(201).json({ 
      message: 'Admin user created successfully', 
      uid: userRecord.uid 
    });
  } catch (error) {
    console.error('Error creando nuevo admin:', error);
    res.status(500).json({ 
      error: 'Failed to register admin', 
      details: error.message 
    });
  }
});

export default router;
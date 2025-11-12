// backend/middlewares/auth_middleware.js

import { auth } from '../firebase-admin.js';
import admin from 'firebase-admin';

async function verifyFirebaseToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const idToken = authHeader.split("Bearer ")[1];

    console.log('🔍 Usando emuladores:', process.env.USE_EMULATORS === 'true');
    console.log('🔍 Entorno:', process.env.NODE_ENV);


    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        req.firebaseUser = decodedToken;
        req.userId = decodedToken.uid; 
        next();
    } catch (error) {
        console.error('❌ Error verifying Firebase token:', error.message);
        console.error('❌ Código de error:', error.code);

        
        let errorMessage = 'Invalid or expired token';
        if (process.env.NODE_ENV === 'development') {
            errorMessage += ` - Detalles: ${error.message}`;

            
            if (error.code === 'auth/argument-error' && error.message.includes('signature')) {
                errorMessage += '. Posiblemente estás usando un token del emulador en un backend de producción, o viceversa.';
            }
        }

        return res.status(403).json({
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
    
}


async function verifyAdminToken(req, res, next) {
    // Reutilizar la lógica de verificación de token
    verifyFirebaseToken(req, res, async () => {
        // req.firebaseUser ahora contiene el token decodificado
        
        // 1. Asegurarse de que el token decodificado existe
        if (!req.firebaseUser) {
            return res.status(401).json({ error: 'Token no válido' });
        }

        // 2. Verificar el claim personalizado 'admin' (o 'role: admin')
        // Ajusta 'req.firebaseUser.admin' al nombre del claim que usas para los admins.
        if (req.firebaseUser.admin !== true) { 
            console.error('❌ Acceso denegado: El usuario no tiene el claim de administrador.');
            return res.status(403).json({ error: 'Acceso denegado. Se requieren privilegios de administrador.' });
        }
        
        // Si pasa ambas verificaciones, continuar
        next();
    });
}

export const verifySelfOrAdmin = async (req, res, next) => {
    try {
        const authenticatedUserId = req.auth.uid;
        const resourceId = req.params.psychologistId;
        
        // Asumiendo que usted tiene una forma de verificar el rol de administrador (puede ser un campo en req.auth)
        const isAdmin = req.auth.role === 'admin'; 

        // 1. Verificar si es Administrador
        if (isAdmin) {
            return next();
        }

        // 2. Verificar si el usuario autenticado es el propietario del recurso (Self)
        if (authenticatedUserId && authenticatedUserId === resourceId) {
            return next();
        }

        // Si no es ni admin ni propietario, denegar acceso
        return res.status(403).json({ 
            error: 'Acceso denegado. Se requiere ser Administrador o el Psicólogo propietario del recurso.' 
        });

    } catch (error) {
        console.error('Error en verifySelfOrAdmin:', error);
        return res.status(500).json({ error: 'Error de autenticación' });
    }
};

export { verifyFirebaseToken, verifyAdminToken };
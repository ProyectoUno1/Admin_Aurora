// AI_Therapy_Teteocan/backend/firebase-admin.js

import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";
import { createRequire } from "module";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

// Define si estamos en modo desarrollo/emuladores
const IS_DEVELOPMENT_ENV = process.env.NODE_ENV === "development";
const USE_EMULATORS_FLAG = process.env.USE_EMULATORS === "true";
const SHOULD_USE_EMULATORS = IS_DEVELOPMENT_ENV || USE_EMULATORS_FLAG;

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "aurora-2b8f4";

if (!admin.apps.length) {
    if (SHOULD_USE_EMULATORS) {
        // Modo Emulador/Desarrollo

        admin.initializeApp({
            projectId: FIREBASE_PROJECT_ID,
        });
    } else {
        try {
            if (process.env.FIREBASE_SERVICE_ACCOUNT) {
                const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
                
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                    projectId: FIREBASE_PROJECT_ID,
                });
            } 
            else {
                const serviceAccountPath = join(__dirname, 'serviceAccountKey.json');
                
                // Requiere el archivo JSON local
                const serviceAccount = require(serviceAccountPath);
                
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                    projectId: FIREBASE_PROJECT_ID,
                });
            }
        } catch (error) {
            console.error("ERROR FATAL: No se pudieron cargar las credenciales de Firebase.");
            console.error("Detalles:", error.message);
            
            if (process.env.NODE_ENV === 'production') {
                try {
                    console.log("Intento final: Usando Application Default Credentials (ADC)...");
                    admin.initializeApp({
                        projectId: FIREBASE_PROJECT_ID,
                    });
                } catch (adcError) {
                    console.error("No se pudo inicializar con ADC:", adcError.message);
                    // Lanza un error fatal si todo falla
                    throw new Error("No se pudo inicializar Firebase Admin SDK. Revise FIREBASE_SERVICE_ACCOUNT o serviceAccountKey.json.");
                }
            } else {
                 // Lanza un error fatal en otros entornos si fallan las credenciales
                throw new Error("No se pudo inicializar Firebase Admin sin credenciales válidas.");
            }
        }
    }
} else {
    console.log("ℹ [Firebase Admin] SDK ya estaba inicializado.");
}

// Exportaciones
export const db = getFirestore();
export const auth = admin.auth();

export default admin;
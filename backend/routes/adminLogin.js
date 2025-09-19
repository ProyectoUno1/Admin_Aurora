import express from "express";
import { auth, db } from "../firebase-admin.js";

const router = express.Router();

// Middleware para verificar token Firebase
const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("No se proporcionó token de autorización");
      return res.status(401).json({
        error: "No se proporcionó token de autorización",
        details: "Debes iniciar sesión primero",
      });
    }

    const idToken = authHeader.split("Bearer ")[1];

    try {
      const decodedToken = await auth.verifyIdToken(idToken);
      console.log("Token verificado para usuario:", decodedToken.uid);

      // Obtener información completa del usuario
      const userRecord = await auth.getUser(decodedToken.uid);
      req.user = {
        ...decodedToken,
        customClaims: userRecord.customClaims || {},
      };

      next();
    } catch (error) {
      console.error("Error verificando token:", error);
      if (error.code === "auth/id-token-expired") {
        return res.status(401).json({
          error: "Token expirado",
          details: "Por favor, inicia sesión nuevamente",
        });
      }
      return res.status(401).json({
        error: "Token inválido",
        details: error.message,
      });
    }
  } catch (error) {
    console.error("Error en middleware de autenticación:", error);
    return res.status(500).json({
      error: "Error de autenticación",
      details: error.message,
    });
  }
};

//Verificar credenciales y obtener información del admin
router.post("/verify", verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.user.uid;

    // Verificar si es administrador
    const userRecord = await auth.getUser(uid);
    const customClaims = userRecord.customClaims || {};

    if (!customClaims.admin) {
      return res
        .status(403)
        .json({
          error: "Acceso denegado. Se requieren privilegios de administrador.",
        });
    }

    // Obtener información adicional del administrador
    const adminDoc = await db.collection("administrators").doc(uid).get();

    if (!adminDoc.exists) {
      return res.status(404).json({ error: "Administrador no encontrado" });
    }

    const adminData = adminDoc.data();

    console.log("Admin login exitoso:", uid);
    res.status(200).json({
      message: "Login successful",
      admin: {
        uid: uid,
        email: userRecord.email,
        createdAt: adminData.createdAt,
        isAdmin: true,
      },
    });
  } catch (error) {
    console.error(" Error verificando admin:", error);
    res
      .status(500)
      .json({ error: "Failed to verify admin", details: error.message });
  }
});

//Obtener perfil del admin logueado
router.get("/profile", verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.user.uid;

    // Verificar si el usuario es admin usando getUser
    const userRecord = await auth.getUser(uid);
    const customClaims = userRecord.customClaims || {};

    if (!customClaims.admin) {
      console.log("Usuario no es admin:", uid);
      return res.status(403).json({
        error: "No tienes privilegios de administrador",
        details: "El usuario no tiene los claims de administrador configurados",
      });
    }

    // Obtener documento del administrador
    const adminDoc = await db.collection("administrators").doc(uid).get();

    if (!adminDoc.exists) {
      // Si no existe el documento, lo creamos
      await db.collection("administrators").doc(uid).set({
        email: userRecord.email,
        createdAt: new Date(),
        role: "admin",
      });

      return res.status(200).json({
        uid: uid,
        email: userRecord.email,
        createdAt: new Date().getTime(),
        isAdmin: true,
      });
    }

    const adminData = adminDoc.data();

    res.status(200).json({
      uid: uid,
      email: userRecord.email,
      createdAt: adminData.createdAt.toDate
        ? adminData.createdAt.toDate().getTime()
        : adminData.createdAt,
      isAdmin: true,
    });
  } catch (error) {
    console.error("Error obteniendo perfil de admin:", error);
    res.status(500).json({
      error: "Error al obtener el perfil",
      details: error.message,
    });
  }
});

export default router;

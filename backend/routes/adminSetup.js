import express from "express";
import { auth, db } from "../firebase-admin.js";

const router = express.Router();

// Ruta de diagnóstico para verificar el estado de un usuario
router.get("/check-admin/:email", async (req, res) => {
  try {
    const { email } = req.params;

    console.log("Verificando estado de admin para:", email);

    // Buscar usuario por email
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch (error) {
      return res.status(404).json({
        error: "Usuario no encontrado",
        details: error.message,
      });
    }

    // Verificar custom claims
    const customClaims = userRecord.customClaims || {};

    // Verificar documento en Firestore
    const adminDoc = await db
      .collection("administrators")
      .doc(userRecord.uid)
      .get();

    res.status(200).json({
      uid: userRecord.uid,
      email: userRecord.email,
      customClaims,
      hasAdminClaim: !!customClaims.admin,
      hasAdminDocument: adminDoc.exists,
      adminDocData: adminDoc.exists ? adminDoc.data() : null,
    });
  } catch (error) {
    console.error("Error en diagnóstico:", error);
    res.status(500).json({
      error: "Error en diagnóstico",
      details: error.message,
    });
  }
});

// Ruta para establecer privilegios de administrador
router.post("/setup-admin", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: "Se requiere el email del administrador",
        details: "Por favor proporciona un email válido",
      });
    }

    console.log("Intentando configurar privilegios de admin para:", email);

    // Buscar usuario por email
    const userRecord = await auth.getUserByEmail(email);
    console.log("Usuario encontrado:", userRecord.uid);

    // Verificar claims actuales
    const currentClaims = userRecord.customClaims || {};
    console.log("Claims actuales:", currentClaims);

    // Establecer custom claims para el usuario
    const newClaims = { ...currentClaims, admin: true };
    await auth.setCustomUserClaims(userRecord.uid, newClaims);
    console.log("Nuevos claims establecidos:", newClaims);

    // Forzar actualización del token
    await auth.revokeRefreshTokens(userRecord.uid);
    console.log("Tokens revocados para forzar actualización");

    // Crear o actualizar documento en la colección administrators
    const adminData = {
      email: userRecord.email,
      createdAt: new Date(),
      role: "admin",
      updatedAt: new Date(),
      customClaims: newClaims,
    };

    await db
      .collection("administrators")
      .doc(userRecord.uid)
      .set(adminData, { merge: true });
    console.log("Documento de administrador actualizado en Firestore");

    // Verificar que los claims se establecieron correctamente
    const updatedUser = await auth.getUser(userRecord.uid);
    console.log(
      "Claims después de la actualización:",
      updatedUser.customClaims
    );

    res.status(200).json({
      message: "Privilegios de administrador establecidos correctamente",
      uid: userRecord.uid,
      claims: updatedUser.customClaims,
      adminData,
      action:
        "Por favor, cierra sesión y vuelve a iniciar sesión para aplicar los cambios",
    });
  } catch (error) {
    console.error("Error estableciendo privilegios de admin:", error);
    res.status(500).json({
      error: "Error estableciendo privilegios de administrador",
      details: error.message,
    });
  }
});

export default router;

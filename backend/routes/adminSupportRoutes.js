// backend/routes/adminSupportRoutes.js

import express from 'express';
import { db, auth} from '../firebase-admin.js'; 


const router = express.Router();

/**
 * Middleware para verificar que el usuario es administrador
 */
const verifyAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ 
        error: "No se proporcionó token de autenticación" 
      });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await auth.verifyIdToken(idToken); 

    // Verificar que tiene claim de admin
    if (!decodedToken.admin) {
      return res.status(403).json({ 
        error: "No tienes permisos de administrador" 
      });
    }

    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Error verificando token de admin:", error);
    return res.status(401).json({ 
      error: "Token inválido o expirado" 
    });
  }
};

//Obtener TODOS los tickets 
router.get("/tickets", verifyAdmin, async (req, res) => {
  try {
    const { status, priority, category, limit } = req.query;

    let query = db.collection("support_tickets");
    if (status) {
      query = query.where("status", "==", status);
    }

    if (priority) {
      query = query.where("priority", "==", priority);
    }

    if (category) {
      query = query.where("category", "==", category);
    }
    query = query.orderBy("createdAt", "desc");
    if (limit) {
      query = query.limit(parseInt(limit));
    }

    const ticketsSnapshot = await query.get();

    if (ticketsSnapshot.empty) {
      return res.status(200).json([]);
    }

    const tickets = [];
    ticketsSnapshot.forEach((doc) => {
      tickets.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    res.status(200).json(tickets);
  } catch (error) {
    console.error("Error al obtener tickets:", error);
    res.status(500).json({
      error: "Error al obtener los tickets",
      details: error.message,
    });
  }
});

//Obtener un ticket específico por ID
router.get("/tickets/:ticketId", verifyAdmin, async (req, res) => {
  try {
    const { ticketId } = req.params;

    const ticketDoc = await db
      .collection("support_tickets")
      .doc(ticketId)
      .get();

    if (!ticketDoc.exists) {
      return res.status(404).json({
        error: "Ticket no encontrado",
      });
    }

    res.status(200).json({
      id: ticketDoc.id,
      ...ticketDoc.data(),
    });
  } catch (error) {
    console.error("Error al obtener ticket:", error);
    res.status(500).json({
      error: "Error al obtener el ticket",
      details: error.message,
    });
  }
});

//Actualizar un ticket (responder, cambiar estado, etc.)
router.patch("/tickets/:ticketId", verifyAdmin, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status, response, priority } = req.body;

    const ticketRef = db.collection("support_tickets").doc(ticketId);
    const ticketDoc = await ticketRef.get();

    if (!ticketDoc.exists) {
      return res.status(404).json({
        error: "Ticket no encontrado",
      });
    }

    const updateData = {
      updatedAt: new Date().toISOString(),
    };
    if (status) {
      updateData.status = status;
    }
    if (priority) {
      updateData.priority = priority;
    }
    if (response) {
      updateData.response = response;
      updateData.responseAt = new Date().toISOString();
      if (!status) {
        updateData.status = "resolved";
      }
    }

    await ticketRef.update(updateData);

    const updatedDoc = await ticketRef.get();

    res.status(200).json({
      success: true,
      message: "Ticket actualizado exitosamente",
      ticket: {
        id: updatedDoc.id,
        ...updatedDoc.data(),
      },
    });
  } catch (error) {
    console.error("Error al actualizar ticket:", error);
    res.status(500).json({
      error: "Error al actualizar el ticket",
      details: error.message,
    });
  }
});

//Eliminar un ticket
router.delete("/tickets/:ticketId", verifyAdmin, async (req, res) => {
  try {
    const { ticketId } = req.params;

    const ticketRef = db.collection("support_tickets").doc(ticketId);
    const ticketDoc = await ticketRef.get();

    if (!ticketDoc.exists) {
      return res.status(404).json({
        error: "Ticket no encontrado",
      });
    }

    await ticketRef.delete();

    res.status(200).json({
      success: true,
      message: "Ticket eliminado exitosamente",
    });
  } catch (error) {
    console.error("Error al eliminar ticket:", error);
    res.status(500).json({
      error: "Error al eliminar el ticket",
      details: error.message,
    });
  }
});


  //Obtener estadísticas de tickets para el dashboard
router.get("/stats", verifyAdmin, async (req, res) => {
  try {
    const ticketsSnapshot = await db
      .collection("support_tickets")
      .get();

    const tickets = [];
    ticketsSnapshot.forEach((doc) => {
      tickets.push(doc.data());
    });

    const stats = {
      total: tickets.length,
      open: tickets.filter(t => t.status === "open").length,
      in_progress: tickets.filter(t => t.status === "in_progress").length,
      resolved: tickets.filter(t => t.status === "resolved").length,
      closed: tickets.filter(t => t.status === "closed").length,
      byPriority: {
        high: tickets.filter(t => t.priority === "high").length,
        medium: tickets.filter(t => t.priority === "medium").length,
        low: tickets.filter(t => t.priority === "low").length,
      },
      byCategory: {
        technical: tickets.filter(t => t.category === "technical").length,
        billing: tickets.filter(t => t.category === "billing").length,
        general: tickets.filter(t => t.category === "general").length,
        complaint: tickets.filter(t => t.category === "complaint").length,
      },
      averageResponseTime: calculateAverageResponseTime(tickets),
    };

    res.status(200).json(stats);
  } catch (error) {
    console.error("Error al obtener estadísticas:", error);
    res.status(500).json({
      error: "Error al obtener las estadísticas",
      details: error.message,
    });
  }
});

/**
 * GET /api/admin/support/tickets/user/:userId
 * Obtener todos los tickets de un usuario específico
 */
router.get("/tickets/user/:userId", verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const ticketsSnapshot = await db
      .collection("support_tickets")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();

    if (ticketsSnapshot.empty) {
      return res.status(200).json([]);
    }

    const tickets = [];
    ticketsSnapshot.forEach((doc) => {
      tickets.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    res.status(200).json(tickets);
  } catch (error) {
    console.error("Error al obtener tickets del usuario:", error);
    res.status(500).json({
      error: "Error al obtener los tickets del usuario",
      details: error.message,
    });
  }
});

//Cerrar un ticket manualmente
router.post("/tickets/:ticketId/close", verifyAdmin, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { closureNote } = req.body;

    const ticketRef = db.collection("support_tickets").doc(ticketId);
    const ticketDoc = await ticketRef.get();

    if (!ticketDoc.exists) {
      return res.status(404).json({
        error: "Ticket no encontrado",
      });
    }

    const updateData = {
      status: "closed",
      closedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (closureNote) {
      updateData.closureNote = closureNote;
    }

    await ticketRef.update(updateData);

    const updatedDoc = await ticketRef.get();

    res.status(200).json({
      success: true,
      message: "Ticket cerrado exitosamente",
      ticket: {
        id: updatedDoc.id,
        ...updatedDoc.data(),
      },
    });
  } catch (error) {
    console.error("Error al cerrar ticket:", error);
    res.status(500).json({
      error: "Error al cerrar el ticket",
      details: error.message,
    });
  }
});

/**
 * POST /api/admin/support/tickets/:ticketId/reopen
 * Reabrir un ticket cerrado
 */
router.post("/tickets/:ticketId/reopen", verifyAdmin, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { reopenReason } = req.body;

    const ticketRef = db.collection("support_tickets").doc(ticketId);
    const ticketDoc = await ticketRef.get();

    if (!ticketDoc.exists) {
      return res.status(404).json({
        error: "Ticket no encontrado",
      });
    }

    const updateData = {
      status: "open",
      reopenedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (reopenReason) {
      updateData.reopenReason = reopenReason;
    }

    await ticketRef.update(updateData);

    const updatedDoc = await ticketRef.get();

    res.status(200).json({
      success: true,
      message: "Ticket reabierto exitosamente",
      ticket: {
        id: updatedDoc.id,
        ...updatedDoc.data(),
      },
    });
  } catch (error) {
    console.error("Error al reabrir ticket:", error);
    res.status(500).json({
      error: "Error al reabrir el ticket",
      details: error.message,
    });
  }
});

// Helper function para calcular tiempo promedio de respuesta
function calculateAverageResponseTime(tickets) {
  const respondedTickets = tickets.filter(t => t.responseAt && t.createdAt);
  
  if (respondedTickets.length === 0) {
    return 0;
  }

  const totalTime = respondedTickets.reduce((sum, ticket) => {
    const created = new Date(ticket.createdAt);
    const responded = new Date(ticket.responseAt);
    const diffHours = (responded - created) / (1000 * 60 * 60);
    return sum + diffHours;
  }, 0);

  return Math.round(totalTime / respondedTickets.length);
}

export default router;